import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner@localhost:5432/neondb";

const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });

export type Db = typeof db;

/** Run work inside a transaction with RLS tenant context. */
export async function withTenant<T>(
  organizationId: string | null,
  userId: string | null,
  fn: (db: Db) => Promise<T>,
  opts?: { bypassRls?: boolean }
): Promise<T> {
  const client = await pool.connect();
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
