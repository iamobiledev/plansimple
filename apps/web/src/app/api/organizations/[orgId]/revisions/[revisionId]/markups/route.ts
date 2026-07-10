import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { withTenant } from "@/db/client";
import { markups } from "@/db/schema";
import { getSession } from "@/server/session";
import { requireMembership } from "@/server/membership";

type Ctx = { params: Promise<{ orgId: string; revisionId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { orgId, revisionId } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    await requireMembership(orgId, session.userId);
  } catch (e) {
    return e as Response;
  }

  const rows = await withTenant(orgId, session.userId, async (db) =>
    db
      .select()
      .from(markups)
      .where(and(eq(markups.organizationId, orgId), eq(markups.revisionId, revisionId)))
      .orderBy(desc(markups.createdAt))
  );
  return NextResponse.json(rows);
}
