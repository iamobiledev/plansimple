import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withBypass } from "@/db/client";
import { users, memberships, organizations } from "@/db/schema";
import { getSession } from "@/server/session";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const data = await withBypass(async (db) => {
    const userRows = await db.select().from(users).where(eq(users.id, session.userId!)).limit(1);
    const user = userRows[0];
    if (!user) return null;
    const orgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(eq(memberships.userId, user.id));
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizations: orgs,
    };
  });

  if (!data) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json(data);
}
