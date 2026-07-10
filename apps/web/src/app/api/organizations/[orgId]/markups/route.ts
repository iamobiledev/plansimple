import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/db/client";
import { markups, auditLog } from "@/db/schema";
import { getSession } from "@/server/session";
import { requireMembership } from "@/server/membership";

type Ctx = { params: Promise<{ orgId: string }> };

const createSchema = z.object({
  pageId: z.string().uuid(),
  revisionId: z.string().uuid(),
  type: z.string().min(1),
  geometry: z.record(z.unknown()),
  style: z.record(z.unknown()).optional(),
  subject: z.string().max(500).optional(),
  layer: z.string().max(120).optional(),
  status: z.string().optional(),
  measurement: z.record(z.unknown()).optional(),
});

export async function POST(req: Request, ctx: Ctx) {
  const { orgId } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    await requireMembership(orgId, session.userId, ["owner", "admin", "editor"]);
  } catch (e) {
    return e as Response;
  }

  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ message: "Validation failed", issues: body.error.issues }, { status: 400 });
  }

  const row = await withTenant(orgId, session.userId, async (db) => {
    const [created] = await db
      .insert(markups)
      .values({
        organizationId: orgId,
        pageId: body.data.pageId,
        revisionId: body.data.revisionId,
        authorId: session.userId!,
        type: body.data.type,
        geometry: body.data.geometry,
        style: body.data.style ?? {},
        status: body.data.status ?? "open",
        subject: body.data.subject ?? null,
        layer: body.data.layer ?? "Default",
        measurement: body.data.measurement ?? null,
      })
      .returning();
    await db.insert(auditLog).values({
      organizationId: orgId,
      actorId: session.userId!,
      action: "markup.create",
      entityType: "markup",
      entityId: created!.id,
      after: created,
    });
    return created!;
  });

  return NextResponse.json(row);
}
