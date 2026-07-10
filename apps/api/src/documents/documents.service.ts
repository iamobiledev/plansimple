import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq, and, asc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import type { InitiateUploadInput } from "@plansimple/shared";
import { DatabaseService } from "../db/database.service";
import { documents, revisions, pages, auditLog } from "../db/schema";
import { OrgsService } from "../orgs/orgs.service";
import { StorageService } from "../storage/storage.service";

const INGEST_QUEUE = "plansimple:ingest";

@Injectable()
export class DocumentsService {
  private readonly redis: Redis;
  private readonly log = new Logger(DocumentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly orgs: OrgsService,
    private readonly storage: StorageService,
    config: ConfigService
  ) {
    this.redis = new Redis(config.get("REDIS_URL") || "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    this.redis.connect().catch((err) => this.log.warn(`Redis connect: ${err}`));
  }

  async initiateUpload(
    organizationId: string,
    projectId: string,
    userId: string,
    input: InitiateUploadInput
  ) {
    await this.orgs.requireRole(organizationId, userId, ["owner", "admin", "editor"]);

    const documentId = randomUUID();
    const revisionId = randomUUID();
    const storageKey = `orgs/${organizationId}/projects/${projectId}/documents/${documentId}/revisions/${revisionId}/original.pdf`;

    await this.db.withTenant(organizationId, userId, async (db) => {
      await db.insert(documents).values({
        id: documentId,
        organizationId,
        projectId,
        documentSetId: input.documentSetId ?? null,
        currentRevisionId: revisionId,
        filename: input.filename,
        pageCount: 0,
        fileSize: input.fileSize,
        storageKey,
        processingStatus: "uploading",
      });
      await db.insert(revisions).values({
        id: revisionId,
        organizationId,
        documentId,
        versionNumber: 1,
        storageKey,
        uploadedBy: userId,
        processingStatus: "uploading",
      });
      await db.insert(auditLog).values({
        organizationId,
        actorId: userId,
        action: "document.initiate_upload",
        entityType: "document",
        entityId: documentId,
        after: { filename: input.filename, revisionId },
      });
    });

    const upload = await this.storage.getUploadUrl(storageKey, input.contentType || "application/pdf");
    return {
      documentId,
      revisionId,
      storageKey,
      upload,
    };
  }

  async completeUpload(
    organizationId: string,
    userId: string,
    documentId: string,
    revisionId: string
  ) {
    await this.orgs.requireRole(organizationId, userId, ["owner", "admin", "editor"]);

    const doc = await this.db.withTenant(organizationId, userId, async (db) => {
      const found = await db.query.documents.findFirst({
        where: and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)),
      });
      if (!found) throw new NotFoundException("Document not found");
      if (!(await this.storage.exists(found.storageKey || ""))) {
        throw new NotFoundException("Uploaded object not found in storage");
      }
      await db
        .update(documents)
        .set({ processingStatus: "processing", updatedAt: new Date() })
        .where(eq(documents.id, documentId));
      await db
        .update(revisions)
        .set({ processingStatus: "processing" })
        .where(eq(revisions.id, revisionId));
      return found;
    });

    const job = {
      organizationId,
      projectId: doc.projectId,
      documentId,
      revisionId,
      storageKey: doc.storageKey,
      callbackUrl: `${process.env.PUBLIC_API_URL || "http://localhost:3000"}/api/internal/ingest/callback`,
    };
    try {
      await this.redis.lpush(INGEST_QUEUE, JSON.stringify(job));
    } catch (err) {
      this.log.error(`Failed to enqueue ingest: ${err}`);
    }

    return { documentId, revisionId, processingStatus: "processing" };
  }

  async list(organizationId: string, projectId: string, userId: string) {
    await this.orgs.requireRole(organizationId, userId, [
      "owner",
      "admin",
      "editor",
      "reviewer",
      "viewer",
    ]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      return db
        .select()
        .from(documents)
        .where(and(eq(documents.organizationId, organizationId), eq(documents.projectId, projectId)));
    });
  }

  async get(organizationId: string, documentId: string, userId: string) {
    await this.orgs.requireRole(organizationId, userId, [
      "owner",
      "admin",
      "editor",
      "reviewer",
      "viewer",
    ]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      const doc = await db.query.documents.findFirst({
        where: and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)),
      });
      if (!doc) throw new NotFoundException("Document not found");
      const revId = doc.currentRevisionId;
      const pageRows = revId
        ? await db
            .select()
            .from(pages)
            .where(eq(pages.revisionId, revId))
            .orderBy(asc(pages.pageNumber))
        : [];
      return { ...doc, pages: pageRows };
    });
  }

  async getPageTiles(
    organizationId: string,
    documentId: string,
    pageId: string,
    userId: string
  ) {
    await this.orgs.requireRole(organizationId, userId, [
      "owner",
      "admin",
      "editor",
      "reviewer",
      "viewer",
    ]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      const page = await db.query.pages.findFirst({
        where: and(eq(pages.id, pageId), eq(pages.organizationId, organizationId)),
      });
      if (!page) throw new NotFoundException("Page not found");
      const tilePrefix = `orgs/${organizationId}/documents/${documentId}/revisions/${page.revisionId}/pages/${page.pageNumber}`;
      const textKey = `${tilePrefix}/text.json`;
      return {
        page,
        tilePrefix,
        /** Client builds `/api/storage/object/${encodeURIComponent(`${tilePrefix}/${z}/${x}/${y}.webp`)}` */
        textKey,
        maxZoom: 4,
        tileSize: 512,
      };
    });
  }

  /** Internal callback from docproc worker (no user JWT; shared secret later). */
  async applyIngestResult(payload: {
    organizationId: string;
    documentId: string;
    revisionId: string;
    pageCount: number;
    pages: Array<{
      pageNumber: number;
      widthPts: number;
      heightPts: number;
      processingStatus: string;
      ocrStatus?: string;
    }>;
    status: "ready" | "failed";
    error?: string;
  }) {
    return this.db.withTenant(payload.organizationId, null, async (db) => {
      await db
        .update(documents)
        .set({
          pageCount: payload.pageCount,
          processingStatus: payload.status,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, payload.documentId));
      await db
        .update(revisions)
        .set({ processingStatus: payload.status })
        .where(eq(revisions.id, payload.revisionId));

      await db.delete(pages).where(eq(pages.revisionId, payload.revisionId));
      for (const p of payload.pages) {
        await db.insert(pages).values({
          organizationId: payload.organizationId,
          revisionId: payload.revisionId,
          pageNumber: p.pageNumber,
          widthPts: p.widthPts,
          heightPts: p.heightPts,
          processingStatus: p.processingStatus,
          ocrStatus: p.ocrStatus || "not_needed",
        });
      }
      return { ok: true };
    }, { bypassRls: true });
  }
}
