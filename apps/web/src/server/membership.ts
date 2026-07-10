import { and, eq } from "drizzle-orm";
import { withBypass } from "@/db/client";
import { memberships } from "@/db/schema";

export async function requireMembership(
  organizationId: string,
  userId: string,
  roles?: string[]
) {
  const rows = await withBypass(async (db) =>
    db
      .select()
      .from(memberships)
      .where(
        and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId))
      )
      .limit(1)
  );
  const m = rows[0];
  if (!m) {
    throw new Response(JSON.stringify({ message: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (roles && !roles.includes(m.role)) {
    throw new Response(JSON.stringify({ message: "Insufficient permissions" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return m;
}
