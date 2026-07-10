import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  "postgresql://plansimple:plansimple@localhost:5432/plansimple";

const hasDb = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!hasDb)("RLS tenant isolation", () => {
  const client = new pg.Client({ connectionString: url });
  let org1: string;
  let org2: string;
  let user1: string;
  let user2: string;
  let project1: string;
  let project2: string;

  beforeAll(async () => {
    await client.connect();
    await client.query("SELECT set_config('app.bypass_rls', 'on', false)");

    const hash = await bcrypt.hash("testpass123", 4);
    const u1 = await client.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1,$2,'A') RETURNING id`,
      [`rls-a-${randomUUID()}@test.local`, hash]
    );
    const u2 = await client.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1,$2,'B') RETURNING id`,
      [`rls-b-${randomUUID()}@test.local`, hash]
    );
    user1 = u1.rows[0].id;
    user2 = u2.rows[0].id;

    const o1 = await client.query(
      `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
      ["Org One", `org-one-${randomUUID().slice(0, 8)}`]
    );
    const o2 = await client.query(
      `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
      ["Org Two", `org-two-${randomUUID().slice(0, 8)}`]
    );
    org1 = o1.rows[0].id;
    org2 = o2.rows[0].id;

    await client.query(
      `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1,$2,'owner'), ($3,$4,'owner')`,
      [org1, user1, org2, user2]
    );

    const p1 = await client.query(
      `INSERT INTO projects (organization_id, name, created_by) VALUES ($1,'P1',$2) RETURNING id`,
      [org1, user1]
    );
    const p2 = await client.query(
      `INSERT INTO projects (organization_id, name, created_by) VALUES ($1,'P2',$2) RETURNING id`,
      [org2, user2]
    );
    project1 = p1.rows[0].id;
    project2 = p2.rows[0].id;

    await client.query("SELECT set_config('app.bypass_rls', 'off', false)");
  });

  afterAll(async () => {
    await client.query("SELECT set_config('app.bypass_rls', 'on', false)");
    await client.query(`DELETE FROM projects WHERE id = ANY($1::uuid[])`, [[project1, project2]]);
    await client.query(`DELETE FROM memberships WHERE organization_id = ANY($1::uuid[])`, [
      [org1, org2],
    ]);
    await client.query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [[org1, org2]]);
    await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [[user1, user2]]);
    await client.end();
  });

  it("org1 context cannot read org2 projects", async () => {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.bypass_rls', 'off', true)");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [org1]);
    const { rows } = await client.query(`SELECT id FROM projects WHERE id = $1`, [project2]);
    expect(rows).toHaveLength(0);
    const own = await client.query(`SELECT id FROM projects WHERE id = $1`, [project1]);
    expect(own.rows).toHaveLength(1);
    await client.query("ROLLBACK");
  });

  it("org2 context cannot read org1 projects", async () => {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.bypass_rls', 'off', true)");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [org2]);
    const { rows } = await client.query(`SELECT id FROM projects WHERE id = $1`, [project1]);
    expect(rows).toHaveLength(0);
    await client.query("ROLLBACK");
  });

  it("empty org context sees no projects", async () => {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.bypass_rls', 'off', true)");
    await client.query("SELECT set_config('app.organization_id', '', true)");
    const { rows } = await client.query(`SELECT id FROM projects`);
    expect(rows).toHaveLength(0);
    await client.query("ROLLBACK");
  });
});

describe("auth schema smoke", () => {
  it("placeholder so vitest always has a passing suite without DB", () => {
    expect(true).toBe(true);
  });
});
