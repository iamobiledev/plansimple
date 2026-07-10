import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/db/client";
import { projects, auditLog } from "@/db/schema";
import { getSession } from "@/server/session";
import { requireMembership } from "@/server/membership";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

type Ctx = { params: Promise<{ orgId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { orgId } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    await requireMembership(orgId, session.userId);
  } catch (e) {
    return e as Response;
  }

  const rows = await withTenant(orgId, session.userId, async (db) =>
    db.select().from(projects).where(eq(projects.organizationId, orgId))
  );
  return NextResponse.json(rows);
}

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
    return NextResponse.json({ message: "Validation failed" }, { status: 400 });
  }

  const project = await withTenant(orgId, session.userId, async (db) => {
    const [created] = await db
      .insert(projects)
      .values({
        organizationId: orgId,
        name: body.data.name,
        description: body.data.description ?? null,
        createdBy: session.userId!,
      })
      .returning();
    await db.insert(auditLog).values({
      organizationId: orgId,
      actorId: session.userId!,
      action: "project.create",
      entityType: "project",
      entityId: created!.id,
      after: { name: created!.name },
    });
    return created!;
  });

  return NextResponse.json(project);
}
