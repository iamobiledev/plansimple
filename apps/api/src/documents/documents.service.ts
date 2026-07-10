import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq, and, asc, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import type { InitiateUploadInput } from "@plansimple/shared";
import { DatabaseService } from "../db/database.service";
import { documents, revisions, pages, markups, auditLog } from "../db/schema";
import { OrgsService } from "../orgs/orgs.service";
import { StorageService } from "../storage/storage.service";

const INGEST_QUEUE = "plansimple:ingest";
const DIFF_QUEUE = "plansimple:diff";

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

  /** Upload a new immutable revision of an existing document. */
  async uploadRevision(
    organizationId: string,
    documentId: string,
    userId: string,
    file: { buffer: Buffer; originalname?: string; size: number; mimetype?: string }
  ) {
    await this.orgs.requireRole(organizationId, userId, ["owner", "admin", "editor"]);

    const { revisionId, storageKey, versionNumber, previousRevisionId, projectId } =
      await this.db.withTenant(organizationId, userId, async (db) => {
        const doc = await db.query.documents.findFirst({
          where: and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)),
        });
        if (!doc) throw new NotFoundException("Document not found");

        const latest = await db
          .select()
          .from(revisions)
          .where(eq(revisions.documentId, documentId))
          .orderBy(desc(revisions.versionNumber))
          .limit(1);
        const versionNumber = (latest[0]?.versionNumber ?? 0) + 1;
        const revisionId = randomUUID();
        const storageKey = `orgs/${organizationId}/projects/${doc.projectId}/documents/${documentId}/revisions/${revisionId}/original.pdf`;

        await db.insert(revisions).values({
          id: revisionId,
          organizationId,
          documentId,
          versionNumber,
          storageKey,
          uploadedBy: userId,
          supersedesRevisionId: doc.currentRevisionId,
          processingStatus: "uploading",
        });
        await db
          .update(documents)
          .set({
            currentRevisionId: revisionId,
            storageKey,
            fileSize: file.size,
            filename: file.originalname || doc.filename,
            processingStatus: "uploading",
            updatedAt: new Date(),
          })
          .where(eq(documents.id, documentId));
        await db.insert(auditLog).values({
          organizationId,
          actorId: userId,
          action: "document.upload_revision",
          entityType: "document",
          entityId: documentId,
          after: { revisionId, versionNumber },
        });
        return {
          revisionId,
          storageKey,
          versionNumber,
          previousRevisionId: doc.currentRevisionId,
          projectId: doc.projectId,
        };
      });

    await this.storage.putObject(storageKey, file.buffer, file.mimetype || "application/pdf");
    await this.completeUpload(organizationId, userId, documentId, revisionId);

    // Stash previous revision for slip-sheet after ingest
    try {
      await this.redis.set(
        `plansimple:slip:${revisionId}`,
        JSON.stringify({ previousRevisionId, organizationId, documentId }),
        "EX",
        86400
      );
    } catch (err) {
      this.log.warn(`slip stash failed: ${err}`);
    }

    return { documentId, revisionId, versionNumber, previousRevisionId, processingStatus: "processing" };
  }

  async listRevisions(organizationId: string, documentId: string, userId: string) {
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
        .from(revisions)
        .where(
          and(eq(revisions.documentId, documentId), eq(revisions.organizationId, organizationId))
        )
        .orderBy(desc(revisions.versionNumber));
    });
  }

  /** Carry markups from previous revision onto new pages (position match by page number). */
  async slipSheetMarkups(
    organizationId: string,
    documentId: string,
    previousRevisionId: string,
    newRevisionId: string
  ) {
    return this.db.withTenant(organizationId, null, async (db) => {
      const oldPages = await db
        .select()
        .from(pages)
        .where(eq(pages.revisionId, previousRevisionId));
      const newPages = await db.select().from(pages).where(eq(pages.revisionId, newRevisionId));
      const newByNum = new Map(newPages.map((p) => [p.pageNumber, p]));

      const oldMarkups = await db
        .select()
        .from(markups)
        .where(eq(markups.revisionId, previousRevisionId));

      let carried = 0;
      for (const m of oldMarkups) {
        const oldPage = oldPages.find((p) => p.id === m.pageId);
        if (!oldPage) continue;
        const newPage = newByNum.get(oldPage.pageNumber);
        if (!newPage) continue;
        const style = {
          ...((m.style as Record<string, unknown>) || {}),
          carriedForward: true,
          fromRevisionId: previousRevisionId,
        };
        await db.insert(markups).values({
          organizationId,
          pageId: newPage.id,
          revisionId: newRevisionId,
          authorId: m.authorId,
          type: m.type,
          geometry: m.geometry,
          style,
          status: m.status,
          subject: m.subject,
          layer: m.layer,
          measurement: m.measurement,
          yjsOriginId: m.yjsOriginId,
        });
        carried += 1;
      }

      // Enqueue pixel diff between revisions
      try {
        await this.redis.lpush(
          DIFF_QUEUE,
          JSON.stringify({
            organizationId,
            documentId,
            previousRevisionId,
            newRevisionId,
            callbackUrl: `${process.env.PUBLIC_API_URL || "http://localhost:3000"}/api/internal/diff/callback`,
          })
        );
      } catch (err) {
        this.log.warn(`diff enqueue failed: ${err}`);
      }

      return { carried };
    }, { bypassRls: true });
  }

  async applyDiffResult(payload: {
    organizationId: string;
    documentId: string;
    previousRevisionId: string;
    newRevisionId: string;
    pages: Array<{
      pageNumber: number;
      changedRegions: Array<{ x: number; y: number; w: number; h: number }>;
    }>;
  }) {
    return this.db.withTenant(payload.organizationId, null, async (db) => {
      const newPages = await db
        .select()
        .from(pages)
        .where(eq(pages.revisionId, payload.newRevisionId));
      const byNum = new Map(newPages.map((p) => [p.pageNumber, p]));

      for (const pageDiff of payload.pages) {
        const page = byNum.get(pageDiff.pageNumber);
        if (!page || !pageDiff.changedRegions.length) continue;

        // Store hotspots as cloud markups on a Diff layer
        for (const region of pageDiff.changedRegions) {
          await db.insert(markups).values({
            organizationId: payload.organizationId,
            pageId: page.id,
            revisionId: payload.newRevisionId,
            type: "cloud",
            geometry: {
              points: [
                { x: region.x, y: region.y },
                { x: region.x + region.w, y: region.y },
                { x: region.x + region.w, y: region.y + region.h },
                { x: region.x, y: region.y + region.h },
              ],
              diffHotspot: true,
            },
            style: { stroke: "#ea580c", strokeWidth: 2, fill: "rgba(234,88,12,0.15)", layer: "Diff" },
            status: "open",
            subject: "Changed region",
            layer: "Diff",
          });
        }

        // Flag carried markups that intersect changed regions
        const pageMarkups = await db
          .select()
          .from(markups)
          .where(and(eq(markups.pageId, page.id), eq(markups.revisionId, payload.newRevisionId)));
        for (const m of pageMarkups) {
          const style = (m.style as Record<string, unknown>) || {};
          if (!style.carriedForward) continue;
          const g = m.geometry as Record<string, unknown>;
          const bounds = this.geometryBounds(g);
          if (!bounds) continue;
          const hits = pageDiff.changedRegions.some((r) =>
            this.rectsOverlap(bounds, { x: r.x, y: r.y, w: r.w, h: r.h })
          );
          if (hits) {
            await db
              .update(markups)
              .set({
                style: { ...style, needsReview: true, flaggedReason: "lands_on_changed_region" },
                status: "in_review",
                updatedAt: new Date(),
              })
              .where(eq(markups.id, m.id));
          }
        }
      }
      return { ok: true };
    }, { bypassRls: true });
  }

  private geometryBounds(g: Record<string, unknown>): { x: number; y: number; w: number; h: number } | null {
    if (typeof g.x === "number" && typeof g.w === "number") {
      return { x: Number(g.x), y: Number(g.y), w: Number(g.w), h: Number(g.h) };
    }
    if (Array.isArray(g.points)) {
      const pts = g.points as Array<{ x: number; y: number }>;
      if (!pts.length) return null;
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
    }
    if (g.x1 != null) {
      const x1 = Number(g.x1);
      const y1 = Number(g.y1);
      const x2 = Number(g.x2);
      const y2 = Number(g.y2);
      return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: Math.abs(x2 - x1),
        h: Math.abs(y2 - y1),
      };
    }
    return null;
  }

  private rectsOverlap(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
  ) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
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
    }, { bypassRls: true }).then(async (result) => {
      // Slip-sheet if this revision superseded another
      try {
        const raw = await this.redis.get(`plansimple:slip:${payload.revisionId}`);
        if (raw && payload.status === "ready") {
          const meta = JSON.parse(raw) as {
            previousRevisionId: string;
            organizationId: string;
            documentId: string;
          };
          if (meta.previousRevisionId) {
            await this.slipSheetMarkups(
              meta.organizationId,
              meta.documentId,
              meta.previousRevisionId,
              payload.revisionId
            );
            await this.redis.del(`plansimple:slip:${payload.revisionId}`);
          }
        }
      } catch (err) {
        this.log.warn(`slip-sheet after ingest failed: ${err}`);
      }
      return result;
    });
  }
}
