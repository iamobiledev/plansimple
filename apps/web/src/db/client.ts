import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { pool?: Pool };

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it in the Vercel project Environment Variables (Neon pooled connection string)."
    );
  }
  return url;
}

export function getPool(): Pool {
  if (globalForDb.pool) return globalForDb.pool;
  const connectionString = requireDatabaseUrl();
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
    max: 10,
  });
  globalForDb.pool = pool;
  return pool;
}

export function getDb(): Db {
  return drizzle(getPool(), { schema });
}

/** @deprecated prefer getDb() — kept for call sites that import `db` */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    return Reflect.get(getPool() as object, prop, receiver);
  },
});

/** Run work inside a transaction with RLS tenant context. */
export async function withTenant<T>(
  organizationId: string | null,
  userId: string | null,
  fn: (db: Db) => Promise<T>,
  opts?: { bypassRls?: boolean }
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (opts?.bypassRls) {
      await client.query("SELECT set_config('app.bypass_rls', 'on', true)");
    } else {
      await client.query("SELECT set_config('app.bypass_rls', 'off', true)");
    }
    await client.query("SELECT set_config('app.organization_id', $1, true)", [
      organizationId ?? "",
    ]);
    if (userId) {
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    }
    const tx = drizzle(client, { schema });
    const result = await fn(tx as unknown as Db);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function withBypass<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return withTenant(null, null, fn, { bypassRls: true });
}
