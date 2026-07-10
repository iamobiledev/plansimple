import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withBypass } from "@/db/client";
import { users } from "@/db/schema";
import { getSession } from "@/server/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (/relation ["']?users["']? does not exist/i.test(msg)) {
    return "Database is reachable but empty (missing users table). Point Vercel DATABASE_URL at the Neon DB that was migrated, or run migrations against the linked Neon database.";
  }
  if (msg) return msg;
  return "Internal error";
}

export async function POST(req: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          message:
            "Server misconfigured: DATABASE_URL is missing. Add the Neon connection string in Vercel → Settings → Environment Variables, then redeploy.",
        },
        { status: 503 }
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const body = schema.safeParse(json);
    if (!body.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }
    const email = body.data.email.toLowerCase();

    const rows = await withBypass(async (db) =>
      db.select().from(users).where(eq(users.email, email)).limit(1)
    );
    const user = rows[0];
    if (!user?.passwordHash) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }
    const ok = await bcrypt.compare(body.data.password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    console.error("login failed", err);
    return NextResponse.json({ message: errorMessage(err) }, { status: 500 });
  }
}
