import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withBypass } from "@/db/client";
import { organizations, memberships, auditLog } from "@/db/schema";
import { getSession } from "@/server/session";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const rows = await withBypass(async (db) =>
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        role: memberships.role,
        createdAt: organizations.createdAt,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(eq(memberships.userId, session.userId!))
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ message: "Validation failed", issues: body.error.issues }, { status: 400 });
  }

  try {
    const org = await withBypass(async (db) => {
      const existing = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, body.data.slug))
        .limit(1);
      if (existing[0]) throw new Error("SLUG");
      const [created] = await db
        .insert(organizations)
        .values({ name: body.data.name, slug: body.data.slug })
        .returning();
      await db.insert(memberships).values({
        organizationId: created!.id,
        userId: session.userId!,
        role: "owner",
      });
      await db.insert(auditLog).values({
        organizationId: created!.id,
        actorId: session.userId!,
        action: "organization.create",
        entityType: "organization",
        entityId: created!.id,
        after: { name: created!.name, slug: created!.slug },
      });
      return created!;
    });
    return NextResponse.json(org);
  } catch (err) {
    if (err instanceof Error && err.message === "SLUG") {
      return NextResponse.json({ message: "Slug already taken" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
