import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { withBypass } from "@/db/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-shot bootstrap for production when DATABASE_URL points at an empty /
 * non-PlanSimple schema (e.g. an older Prisma DB). Creates the `users` table
 * and seeds demo@plansimple.dev if missing.
 *
 * Protect with SETUP_SECRET (or allow once when users table is missing).
 */
export async function POST(req: Request) {
  const setupSecret = process.env.SETUP_SECRET?.trim();
  const provided =
    req.headers.get("x-plansimple-setup-secret") ||
    new URL(req.url).searchParams.get("secret") ||
    "";

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ message: "DATABASE_URL missing" }, { status: 503 });
  }

  try {
    const result = await withBypass(async (db) => {
      const tablesRes = await db.execute(sql`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `);
      const tables = (tablesRes.rows as Array<{ tablename: string }>).map(
        (r) => r.tablename
      );
      const hasUsers = tables.includes("users");

      // If users already exists, require SETUP_SECRET to re-seed
      if (hasUsers && setupSecret && provided !== setupSecret) {
        return {
          ok: false,
          status: 401 as const,
          message: "users table already exists; SETUP_SECRET required to re-run",
          tables,
        };
      }
      if (hasUsers && !setupSecret && provided !== "force") {
        const countRes = await db.execute(sql`SELECT count(*)::int AS count FROM users`);
        const userCount = Number((countRes.rows[0] as { count: number })?.count ?? 0);
        return {
          ok: true,
          status: 200 as const,
          message: "users table already present",
          tables,
          userCount,
          seeded: false,
        };
      }

      try {
        await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
      } catch {
        /* may already exist or lack permission */
      }

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT,
          name TEXT,
          avatar_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

      const passwordHash = await bcrypt.hash("plansimple123", 12);
      await db.execute(sql`
        INSERT INTO users (email, password_hash, name)
        VALUES ('demo@plansimple.dev', ${passwordHash}, 'Demo User')
        ON CONFLICT (email) DO UPDATE
          SET password_hash = EXCLUDED.password_hash,
              name = EXCLUDED.name,
              updated_at = now()
      `);

      const countRes = await db.execute(sql`SELECT count(*)::int AS count FROM users`);
      const userCount = Number((countRes.rows[0] as { count: number })?.count ?? 0);
      const tablesAfter = await db.execute(sql`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
      `);

      return {
        ok: true,
        status: 200 as const,
        message: "users table ready and demo user seeded",
        tables: (tablesAfter.rows as Array<{ tablename: string }>).map((r) => r.tablename),
        userCount,
        seeded: true,
        demo: { email: "demo@plansimple.dev", password: "plansimple123" },
      };
    });

    return NextResponse.json(result, { status: result.status });
  } catch (err) {
    console.error("setup failed", err);
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "setup failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to bootstrap users table + demo seed on the configured DATABASE_URL",
  });
}
