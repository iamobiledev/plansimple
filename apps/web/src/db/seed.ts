import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { withBypass } from "./client";
import { users, organizations, memberships, projects } from "./schema";

async function main() {
  const passwordHash = await bcrypt.hash("plansimple123", 12);

  const result = await withBypass(async (db) => {
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, "demo@plansimple.dev"))
      .limit(1);
    let userId = existingUsers[0]?.id;
    if (!userId) {
      const [u] = await db
        .insert(users)
        .values({
          email: "demo@plansimple.dev",
          passwordHash,
          name: "Demo User",
        })
        .returning();
      userId = u!.id;
    } else {
      await db
        .update(users)
        .set({ passwordHash, name: "Demo User" })
        .where(eq(users.id, userId));
    }

    const existingOrgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, "demo-construction"))
      .limit(1);
    let orgId = existingOrgs[0]?.id;
    if (!orgId) {
      const [o] = await db
        .insert(organizations)
        .values({ name: "Demo Construction Co", slug: "demo-construction" })
        .returning();
      orgId = o!.id;
    }

    const mem = await db
      .select()
      .from(memberships)
      .where(eq(memberships.organizationId, orgId))
      .limit(5);
    if (!mem.some((m) => m.userId === userId)) {
      await db.insert(memberships).values({
        organizationId: orgId,
        userId,
        role: "owner",
      });
    }

    const existingProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, orgId))
      .limit(5);
    let projectId = existingProjects.find((p) => p.name === "Demo Office Building")?.id;
    if (!projectId) {
      const [p] = await db
        .insert(projects)
        .values({
          organizationId: orgId,
          name: "Demo Office Building",
          description: "Vercel + Neon demo project",
          createdBy: userId,
        })
        .returning();
      projectId = p!.id;
    }

    return { userId, orgId, projectId };
  });

  console.log(
    JSON.stringify(
      {
        email: "demo@plansimple.dev",
        password: "plansimple123",
        ...result,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
