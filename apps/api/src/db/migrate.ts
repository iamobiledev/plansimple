import fs from "node:fs";
import path from "node:path";
import pg from "pg";

async function main() {
  const url =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL ||
    "postgresql://plansimple:plansimple@localhost:5432/plansimple";

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const dir = path.join(__dirname, "../../drizzle");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const id = file;
    const { rows } = await client.query("SELECT 1 FROM schema_migrations WHERE id = $1", [id]);
    if (rows.length) {
      console.log(`skip ${id}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    console.log(`apply ${id}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }

  await client.end();
  console.log("migrations complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
