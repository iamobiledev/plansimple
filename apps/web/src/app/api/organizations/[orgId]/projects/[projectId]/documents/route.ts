import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { withTenant } from "@/db/client";
import { documents, revisions, pages, auditLog } from "@/db/schema";
import { getSession } from "@/server/session";
import { requireMembership } from "@/server/membership";
import { PDFDocument } from "pdf-lib";

type Ctx = { params: Promise<{ orgId: string; projectId: string }> };

export const maxDuration = 60;

export async function GET(_req: Request, ctx: Ctx) {
  const { orgId, projectId } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    await requireMembership(orgId, session.userId);
  } catch (e) {
    return e as Response;
  }

  const rows = await withTenant(orgId, session.userId, async (db) =>
    db.select().from(documents).where(eq(documents.projectId, projectId))
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request, ctx: Ctx) {
  const { orgId, projectId } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    await requireMembership(orgId, session.userId, ["owner", "admin", "editor"]);
  } catch (e) {
    return e as Response;
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ message: "file required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const documentId = randomUUID();
  const revisionId = randomUUID();
  const pathname = `orgs/${orgId}/projects/${projectId}/documents/${documentId}/revisions/${revisionId}/original.pdf`;

  let blobUrl = pathname;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(pathname, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type || "application/pdf",
    });
    blobUrl = blob.url;
  } else {
    // Local fallback: store as data URL key marker; write to /tmp for local only
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "uploads");
    await fs.mkdir(path.dirname(path.join(dir, pathname)), { recursive: true });
    await fs.writeFile(path.join(dir, pathname), buffer);
    blobUrl = `/api/files/${encodeURIComponent(pathname)}`;
  }

  let pageCount = 1;
  try {
    const pdf = await PDFDocument.load(buffer);
    pageCount = pdf.getPageCount();
  } catch {
    pageCount = 1;
  }

  const doc = await withTenant(orgId, session.userId, async (db) => {
    await db.insert(documents).values({
      id: documentId,
      organizationId: orgId,
      projectId,
      currentRevisionId: revisionId,
      filename: file.name || "drawing.pdf",
      pageCount,
      fileSize: file.size,
      storageKey: blobUrl,
      processingStatus: "ready",
    });
    await db.insert(revisions).values({
      id: revisionId,
      organizationId: orgId,
      documentId,
      versionNumber: 1,
      storageKey: blobUrl,
      uploadedBy: session.userId!,
      processingStatus: "ready",
    });

    // Create page rows with letter-ish defaults; refined client-side from pdf.js
    for (let i = 1; i <= pageCount; i++) {
      await db.insert(pages).values({
        organizationId: orgId,
        revisionId,
        pageNumber: i,
        widthPts: 612,
        heightPts: 792,
        processingStatus: "ready",
      });
    }

    await db.insert(auditLog).values({
      organizationId: orgId,
      actorId: session.userId!,
      action: "document.upload",
      entityType: "document",
      entityId: documentId,
      after: { filename: file.name, pageCount },
    });

    return { documentId, revisionId, pageCount, storageKey: blobUrl };
  });

  return NextResponse.json(doc);
}
