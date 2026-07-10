#!/usr/bin/env tsx
/**
 * Seed demo user/org/project and enqueue 3 sample drawing sets for ingest.
 * Requires: migrated DB, MinIO (or local storage), Redis optional for enqueue.
 */
import * as bcrypt from "bcryptjs";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import Redis from "ioredis";

const FIXTURES = [
  { filename: "architectural-set.pdf", label: "Architectural Set" },
  { filename: "structural-set.pdf", label: "Structural Set" },
  { filename: "mep-set.pdf", label: "MEP Set" },
];

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
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
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

  let projectId: string;
  const existing = await client.query(
    `SELECT id FROM projects WHERE organization_id = $1 AND name = $2 LIMIT 1`,
    [orgId, "Demo Office Building"]
  );
  if (existing.rows[0]) {
    projectId = existing.rows[0].id;
  } else {
    const projectRes = await client.query(
      `INSERT INTO projects (organization_id, name, description, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [orgId, "Demo Office Building", "Seeded demo with 3 drawing sets", userId]
    );
    projectId = projectRes.rows[0].id;
  }

  const fixturesDir = path.join(process.cwd(), "scripts/fixtures");
  // When invoked via pnpm --filter @plansimple/api, cwd is apps/api.
  const altDir = path.join(process.cwd(), "../../scripts/fixtures");
  const resolvedFixtures = existsSync(path.join(fixturesDir, FIXTURES[0]!.filename))
    ? fixturesDir
    : altDir;
  const driver = process.env.STORAGE_DRIVER || "s3";
  const s3 =
    driver === "s3"
      ? new S3Client({
          region: process.env.S3_REGION || "us-east-1",
          endpoint: process.env.S3_ENDPOINT || "http://127.0.0.1:9000",
          forcePathStyle: true,
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY || "plansimple",
            secretAccessKey: process.env.S3_SECRET_KEY || "plansimplesecret",
          },
        })
      : null;
  const bucket = process.env.S3_BUCKET || "plansimple";
  const localDir = process.env.FILE_STORAGE_DIR || path.join(process.cwd(), "uploads");

  let redis: Redis | null = null;
  try {
    redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    await redis.connect();
  } catch {
    redis = null;
  }

  const created: Array<{ filename: string; documentId: string }> = [];

  for (const fixture of FIXTURES) {
    const filePath = path.join(resolvedFixtures, fixture.filename);
    if (!existsSync(filePath)) {
      console.warn(`missing fixture ${filePath} — run scripts/generate-fixture-pdfs.py`);
      continue;
    }
    const buf = readFileSync(filePath);
    const documentId = randomUUID();
    const revisionId = randomUUID();
    const storageKey = `orgs/${orgId}/projects/${projectId}/documents/${documentId}/revisions/${revisionId}/original.pdf`;

    if (s3) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: buf,
          ContentType: "application/pdf",
        })
      );
    } else {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      const full = path.join(localDir, storageKey);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, buf);
    }

    await client.query(
      `INSERT INTO documents (id, organization_id, project_id, current_revision_id, filename, page_count, file_size, storage_key, processing_status)
       VALUES ($1,$2,$3,$4,$5,0,$6,$7,'processing')`,
      [documentId, orgId, projectId, revisionId, fixture.filename, buf.length, storageKey]
    );
    await client.query(
      `INSERT INTO revisions (id, organization_id, document_id, version_number, storage_key, uploaded_by, processing_status)
       VALUES ($1,$2,$3,1,$4,$5,'processing')`,
      [revisionId, orgId, documentId, storageKey, userId]
    );

    if (redis) {
      await redis.lpush(
        "plansimple:ingest",
        JSON.stringify({
          organizationId: orgId,
          projectId,
          documentId,
          revisionId,
          storageKey,
          callbackUrl: `${process.env.PUBLIC_API_URL || "http://127.0.0.1:3000"}/api/internal/ingest/callback`,
        })
      );
    }
    created.push({ filename: fixture.filename, documentId });
  }

  console.log(
    JSON.stringify(
      {
        email: "demo@plansimple.dev",
        password: "plansimple123",
        organizationId: orgId,
        projectId,
        documents: created,
        ingestEnqueued: Boolean(redis),
      },
      null,
      2
    )
  );

  await redis?.quit();
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
