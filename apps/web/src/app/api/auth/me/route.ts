import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withBypass } from "@/db/client";
import { users } from "@/db/schema";
import { getSession } from "@/server/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rows = await withBypass(async (db) =>
      db.select().from(users).where(eq(users.id, session.userId!)).limit(1)
    );
    const user = rows[0];
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    console.error("me failed", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
