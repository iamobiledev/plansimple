import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { withBypass } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasSessionSecret = Boolean(process.env.SESSION_SECRET?.trim());

  if (!hasDatabaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        hasDatabaseUrl,
        hasSessionSecret,
        message: "DATABASE_URL is not set on this deployment.",
      },
      { status: 503 }
    );
  }

  try {
    const result = await withBypass(async (db) => {
      const tables = await db.execute(sql`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `);
      const users = await db.execute(sql`SELECT count(*)::int AS count FROM users`);
      return {
        tables: (tables.rows as Array<{ tablename: string }>).map((r) => r.tablename),
        userCount: Number((users.rows[0] as { count: number } | undefined)?.count ?? 0),
      };
    });

    return NextResponse.json({
      ok: true,
      hasDatabaseUrl,
      hasSessionSecret,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database check failed";
    return NextResponse.json(
      {
        ok: false,
        hasDatabaseUrl,
        hasSessionSecret,
        message,
      },
      { status: 500 }
    );
  }
}
