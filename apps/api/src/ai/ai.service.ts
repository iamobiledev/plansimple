import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, asc } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import { pages, documents, aiUsage, markups } from "../db/schema";
import { OrgsService } from "../orgs/orgs.service";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class AiService {
  private readonly log = new Logger(AiService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly orgs: OrgsService,
    private readonly storage: StorageService,
    config: ConfigService
  ) {
    this.baseUrl = (config.get("AI_WORKER_URL") || "http://127.0.0.1:8002").replace(/\/$/, "");
  }

  private async meter(
    organizationId: string,
    userId: string | null,
    feature: string,
    tokens = { in: 0, out: 0 }
  ) {
    await this.db.withTenant(organizationId, userId, async (db) => {
      await db.insert(aiUsage).values({
        organizationId,
        userId,
        feature,
        inputTokens: tokens.in,
        outputTokens: tokens.out,
      });
    }, { bypassRls: true });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.log.warn(`AI worker unreachable: ${err}`);
      throw new ServiceUnavailableException("AI service unavailable");
    }
    if (res.status === 503) {
      throw new ServiceUnavailableException("AI not configured");
    }
    if (!res.ok) {
      const text = await res.text();
      throw new ServiceUnavailableException(`AI error: ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  async indexDocumentPages(organizationId: string, documentId: string, userId: string) {
    await this.orgs.requireRole(organizationId, userId, ["owner", "admin", "editor"]);
    const doc = await this.db.withTenant(organizationId, userId, async (db) => {
      return db.query.documents.findFirst({
        where: and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)),
      });
    });
    if (!doc?.currentRevisionId) throw new ServiceUnavailableException("Document not ready");

    const pageRows = await this.db.withTenant(organizationId, userId, async (db) => {
      return db
        .select()
        .from(pages)
        .where(eq(pages.revisionId, doc.currentRevisionId!))
        .orderBy(asc(pages.pageNumber));
    });

    const results = [];
    for (const page of pageRows) {
      const textKey = `orgs/${organizationId}/documents/${documentId}/revisions/${page.revisionId}/pages/${page.pageNumber}/text.json`;
      let text = "";
      try {
        const buf = await this.storage.getObjectBuffer(textKey);
        const parsed = JSON.parse(buf.toString("utf8")) as { spans?: Array<{ text: string }> };
        text = (parsed.spans || []).map((s) => s.text).join(" ");
      } catch {
        text = "";
      }
      const indexed = await this.post<{
        sheetNumber?: string;
        sheetTitle?: string;
        discipline?: string;
        revision?: string;
        confidence?: number;
        verifyMe?: boolean;
        source?: string;
      }>("/v1/sheet-index", { text, page_number: page.pageNumber });

      await this.db.withTenant(organizationId, userId, async (db) => {
        await db
          .update(pages)
          .set({
            sheetNumber: indexed.sheetNumber ?? page.sheetNumber,
            sheetTitle: indexed.sheetTitle ?? page.sheetTitle,
            discipline: indexed.discipline ?? page.discipline,
          })
          .where(eq(pages.id, page.id));
      });
      results.push({ pageId: page.id, pageNumber: page.pageNumber, ...indexed });
    }
    await this.meter(organizationId, userId, "sheet_indexing");
    return { pages: results, verifyMe: true };
  }

  async updatePageIndex(
    organizationId: string,
    pageId: string,
    userId: string,
    fields: { sheetNumber?: string; sheetTitle?: string; discipline?: string }
  ) {
    await this.orgs.requireRole(organizationId, userId, ["owner", "admin", "editor"]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      const [row] = await db
        .update(pages)
        .set({
          sheetNumber: fields.sheetNumber,
          sheetTitle: fields.sheetTitle,
          discipline: fields.discipline,
        })
        .where(and(eq(pages.id, pageId), eq(pages.organizationId, organizationId)))
        .returning();
      return row;
    });
  }

  async nlSearch(
    organizationId: string,
    projectId: string,
    userId: string,
    query: string
  ) {
    await this.orgs.requireRole(organizationId, userId, [
      "owner",
      "admin",
      "editor",
      "reviewer",
      "viewer",
    ]);
    const docs = await this.db.withTenant(organizationId, userId, async (db) => {
      return db
        .select()
        .from(documents)
        .where(and(eq(documents.organizationId, organizationId), eq(documents.projectId, projectId)));
    });

    const summaries: Array<Record<string, unknown>> = [];
    for (const doc of docs) {
      if (!doc.currentRevisionId) continue;
      const pageRows = await this.db.withTenant(organizationId, userId, async (db) => {
        return db
          .select()
          .from(pages)
          .where(eq(pages.revisionId, doc.currentRevisionId!))
          .orderBy(asc(pages.pageNumber));
      });
      for (const page of pageRows) {
        const textKey = `orgs/${organizationId}/documents/${doc.id}/revisions/${page.revisionId}/pages/${page.pageNumber}/text.json`;
        let text = `${page.sheetNumber || ""} ${page.sheetTitle || ""} ${page.discipline || ""}`;
        try {
          const buf = await this.storage.getObjectBuffer(textKey);
          const parsed = JSON.parse(buf.toString("utf8")) as { spans?: Array<{ text: string }> };
          text += " " + (parsed.spans || []).map((s) => s.text).join(" ");
        } catch {
          /* ignore */
        }
        summaries.push({
          documentId: doc.id,
          pageId: page.id,
          pageNumber: page.pageNumber,
          sheetNumber: page.sheetNumber || `p${page.pageNumber}`,
          text,
          summary: text.slice(0, 500),
        });
      }
    }

    const result = await this.post<{ results: Array<Record<string, unknown>>; verifyMe?: boolean }>(
      "/v1/nl-search",
      { query, page_summaries: summaries }
    );
    await this.meter(organizationId, userId, "nl_search");
    return result;
  }

  async draftRfi(
    organizationId: string,
    userId: string,
    input: { markupId?: string; subject?: string; comments?: string[] }
  ) {
    await this.orgs.requireRole(organizationId, userId, ["owner", "admin", "editor"]);
    let subject = input.subject || "Drawing clarification";
    const comments = input.comments || [];
    if (input.markupId) {
      const m = await this.db.withTenant(organizationId, userId, async (db) => {
        const rows = await db.select().from(markups).where(eq(markups.id, input.markupId!));
        return rows[0];
      });
      if (m?.subject) subject = m.subject;
    }
    const draft = await this.post<Record<string, unknown>>("/v1/draft-rfi", {
      markup_subject: subject,
      comments,
    });
    await this.meter(organizationId, userId, "rfi_draft");
    return { ...draft, verifyMe: true };
  }

  async health() {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) return { ok: false };
      return res.json();
    } catch {
      return { ok: false };
    }
  }
}
