import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly pool: pg.Pool;
  readonly db: Db;

  constructor(config: ConfigService) {
    const connectionString =
      config.get<string>("DATABASE_URL") ||
      "postgresql://plansimple:plansimple@localhost:5432/plansimple";
    this.pool = new pg.Pool({ connectionString, max: 20 });
    this.db = drizzle(this.pool, { schema });
  }

  /** Run a callback with RLS tenant context set on a dedicated client. */
  async withTenant<T>(
    organizationId: string | null,
    userId: string | null,
    fn: (db: Db, client: pg.PoolClient) => Promise<T>,
    opts?: { bypassRls?: boolean }
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (opts?.bypassRls) {
        await client.query("SELECT set_config('app.bypass_rls', 'on', true)");
      } else {
        await client.query("SELECT set_config('app.bypass_rls', 'off', true)");
      }
      if (organizationId) {
        await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
      } else {
        await client.query("SELECT set_config('app.organization_id', '', true)");
      }
      if (userId) {
        await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      }
      const db = drizzle(client, { schema });
      const result = await fn(db, client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /** Bypass RLS for auth/bootstrap operations (user lookup, org create). */
  async withBypass<T>(fn: (db: Db, client: pg.PoolClient) => Promise<T>): Promise<T> {
    return this.withTenant(null, null, fn, { bypassRls: true });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
