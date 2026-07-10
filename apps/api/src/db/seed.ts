import * as bcrypt from "bcryptjs";
import pg from "pg";

async function main() {
  const url =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL ||
    "postgresql://plansimple:plansimple@localhost:5432/plansimple";
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("SELECT set_config('app.bypass_rls', 'on', false)");

  const passwordHash = await bcrypt.hash("plansimple123", 12);

  const userRes = await client.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name
     RETURNING id`,
    ["demo@plansimple.dev", passwordHash, "Demo User"]
  );
  const userId = userRes.rows[0].id as string;

  const orgRes = await client.query(
    `INSERT INTO organizations (name, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    ["Demo Construction Co", "demo-construction"]
  );
  const orgId = orgRes.rows[0].id as string;

  await client.query(
    `INSERT INTO memberships (organization_id, user_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT DO NOTHING`,
    [orgId, userId]
  );

  const projectRes = await client.query(
    `INSERT INTO projects (organization_id, name, description, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [orgId, "Demo Office Building", "Seeded demo project for PlanSimple", userId]
  );

  console.log(
    JSON.stringify(
      {
        email: "demo@plansimple.dev",
        password: "plansimple123",
        organizationId: orgId,
        projectId: projectRes.rows[0].id,
      },
      null,
      2
    )
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
