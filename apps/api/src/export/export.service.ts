import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { and, eq, asc } from "drizzle-orm";
import {
  PDFDocument,
  rgb,
  degrees,
  StandardFonts,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { DatabaseService } from "../db/database.service";
import { documents, pages, markups, revisions } from "../db/schema";
import { OrgsService } from "../orgs/orgs.service";
import { StorageService } from "../storage/storage.service";
import { cloudPathFromPolygon } from "@plansimple/shared";

type ExportMode = "original" | "annotations" | "flattened";

function parseColor(input: unknown, fallback: RGB): RGB {
  if (typeof input !== "string") return fallback;
  const hex = input.replace("#", "");
  if (hex.length !== 6) return fallback;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  if ([r, g, b].some((v) => Number.isNaN(v))) return fallback;
  return rgb(r, g, b);
}

/** PDF user space origin is bottom-left; our geometry is top-left PDF points. */
function flipY(pageHeight: number, y: number) {
  return pageHeight - y;
}

@Injectable()
export class ExportService {
  private readonly log = new Logger(ExportService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly orgs: OrgsService,
    private readonly storage: StorageService
  ) {}

  async exportDocument(
    organizationId: string,
    documentId: string,
    userId: string,
    mode: ExportMode
  ): Promise<{ bytes: Uint8Array; filename: string; contentType: string }> {
    await this.orgs.requireRole(organizationId, userId, [
      "owner",
      "admin",
      "editor",
      "reviewer",
      "viewer",
    ]);

    const ctx = await this.db.withTenant(organizationId, userId, async (db) => {
      const doc = await db.query.documents.findFirst({
        where: and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)),
      });
      if (!doc?.currentRevisionId || !doc.storageKey) {
        throw new NotFoundException("Document not found");
      }
      const rev = await db.query.revisions.findFirst({
        where: eq(revisions.id, doc.currentRevisionId),
      });
      if (!rev) throw new NotFoundException("Revision not found");
      const pageRows = await db
        .select()
        .from(pages)
        .where(eq(pages.revisionId, rev.id))
        .orderBy(asc(pages.pageNumber));
      const markupRows =
        mode === "original"
          ? []
          : await db
              .select()
              .from(markups)
              .where(eq(markups.revisionId, rev.id));
      return { doc, rev, pageRows, markupRows };
    });

    const pdfBytes = await this.storage.getObjectBuffer(ctx.doc.storageKey!);
    if (mode === "original") {
      return {
        bytes: pdfBytes,
        filename: ctx.doc.filename,
        contentType: "application/pdf",
      };
    }

    const pdf = await PDFDocument.load(pdfBytes);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pdfPages = pdf.getPages();
    const byPage = new Map<string, typeof ctx.markupRows>();
    for (const m of ctx.markupRows) {
      const list = byPage.get(m.pageId) ?? [];
      list.push(m);
      byPage.set(m.pageId, list);
    }

    for (const pageRow of ctx.pageRows) {
      const pageIndex = pageRow.pageNumber - 1;
      const page = pdfPages[pageIndex];
      if (!page) continue;
      const pageMarkups = byPage.get(pageRow.id) ?? [];
      for (const m of pageMarkups) {
        try {
          this.drawMarkupOnPage(page, pageRow.heightPts, m, font, mode === "flattened");
        } catch (err) {
          this.log.warn(`Failed to draw markup ${m.id}: ${err}`);
        }
      }
    }

    const out = await pdf.save();
    const suffix = mode === "flattened" ? "-flattened" : "-annotated";
    const base = ctx.doc.filename.replace(/\.pdf$/i, "");
    return {
      bytes: out,
      filename: `${base}${suffix}.pdf`,
      contentType: "application/pdf",
    };
  }

  private drawMarkupOnPage(
    page: PDFPage,
    pageHeight: number,
    m: {
      type: string;
      geometry: unknown;
      style: unknown;
      subject: string | null;
    },
    font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
    flattened: boolean
  ) {
    const g = (m.geometry || {}) as Record<string, number | unknown>;
    const style = (m.style || {}) as Record<string, unknown>;
    const stroke = parseColor(style.stroke, rgb(0.88, 0.11, 0.28));
    const fill = parseColor(style.fill, rgb(0.88, 0.11, 0.28));
    const borderWidth = Number(style.strokeWidth ?? 2);
    const opacity = Number(style.opacity ?? 1);
    const type = m.type;

    const drawOpts = {
      borderColor: stroke,
      borderWidth,
      color: style.fill && style.fill !== "transparent" ? fill : undefined,
      opacity,
      borderOpacity: opacity,
    };

    if (type === "rectangle" || type === "highlighter" || type === "stamp" || type === "textbox") {
      const x = Number(g.x ?? 0);
      const y = Number(g.y ?? 0);
      const w = Number(g.w ?? (type === "textbox" ? 120 : 0));
      const h = Number(g.h ?? (type === "textbox" ? 24 : 0));
      if (type !== "textbox") {
        page.drawRectangle({
          x,
          y: flipY(pageHeight, y + h),
          width: w,
          height: h,
          ...drawOpts,
          color:
            type === "highlighter"
              ? rgb(0.98, 0.8, 0.08)
              : drawOpts.color,
          opacity: type === "highlighter" ? 0.35 : opacity,
          borderWidth: type === "highlighter" ? 0 : borderWidth,
        });
      }
      if (type === "stamp" || type === "textbox") {
        const text = String(g.text ?? m.subject ?? "STAMP");
        page.drawText(text, {
          x: x + 4,
          y: flipY(pageHeight, y + 14),
          size: Number(style.fontSize ?? 10),
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
      }
      void flattened;
      return;
    }

    if (type === "ellipse") {
      const x = Number(g.x ?? 0);
      const y = Number(g.y ?? 0);
      const w = Number(g.w ?? 0);
      const h = Number(g.h ?? 0);
      page.drawEllipse({
        x: x + w / 2,
        y: flipY(pageHeight, y + h / 2),
        xScale: Math.abs(w) / 2,
        yScale: Math.abs(h) / 2,
        borderColor: stroke,
        borderWidth,
        opacity,
      });
      return;
    }

    if (type === "line" || type === "arrow") {
      const x1 = Number(g.x1 ?? 0);
      const y1 = Number(g.y1 ?? 0);
      const x2 = Number(g.x2 ?? 0);
      const y2 = Number(g.y2 ?? 0);
      page.drawLine({
        start: { x: x1, y: flipY(pageHeight, y1) },
        end: { x: x2, y: flipY(pageHeight, y2) },
        thickness: borderWidth,
        color: stroke,
        opacity,
      });
      return;
    }

    if (
      type === "polyline" ||
      type === "polygon" ||
      type === "freehand" ||
      type === "cloud" ||
      type === "cloud_callout"
    ) {
      let points = Array.isArray(g.points)
        ? (g.points as Array<{ x: number; y: number }>)
        : [];
      if ((type === "cloud" || type === "cloud_callout") && points.length >= 3) {
        points = cloudPathFromPolygon(points, { radius: 8 });
      }
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]!;
        const b = points[i]!;
        page.drawLine({
          start: { x: a.x, y: flipY(pageHeight, a.y) },
          end: { x: b.x, y: flipY(pageHeight, b.y) },
          thickness: borderWidth,
          color: stroke,
          opacity,
        });
      }
      if ((type === "polygon" || type === "cloud" || type === "cloud_callout") && points.length > 2) {
        const a = points[points.length - 1]!;
        const b = points[0]!;
        page.drawLine({
          start: { x: a.x, y: flipY(pageHeight, a.y) },
          end: { x: b.x, y: flipY(pageHeight, b.y) },
          thickness: borderWidth,
          color: stroke,
          opacity,
        });
      }
      return;
    }

    if (type === "textbox" || type === "callout") {
      const x = Number(g.x ?? 0);
      const y = Number(g.y ?? 0);
      const text = String(g.text ?? m.subject ?? "Text");
      page.drawText(text, {
        x,
        y: flipY(pageHeight, y),
        size: Number(style.fontSize ?? 12),
        font,
        color: rgb(0.05, 0.05, 0.05),
        rotate: degrees(0),
      });
    }
  }
}
