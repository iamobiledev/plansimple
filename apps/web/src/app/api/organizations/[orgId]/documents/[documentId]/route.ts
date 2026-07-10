import { NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { withTenant } from "@/db/client";
import { documents, pages } from "@/db/schema";
import { getSession } from "@/server/session";
import { requireMembership } from "@/server/membership";

type Ctx = { params: Promise<{ orgId: string; documentId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { orgId, documentId } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    await requireMembership(orgId, session.userId);
  } catch (e) {
    return e as Response;
  }

  const result = await withTenant(orgId, session.userId, async (db) => {
    const docs = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.organizationId, orgId)))
      .limit(1);
    const doc = docs[0];
    if (!doc) return null;
    const pageRows = doc.currentRevisionId
      ? await db
          .select()
          .from(pages)
          .where(eq(pages.revisionId, doc.currentRevisionId))
          .orderBy(asc(pages.pageNumber))
      : [];
    return { ...doc, pages: pageRows };
  });

  if (!result) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}
