# AGENTS.md

## Cursor Cloud specific instructions

PlanSimple is a **single Next.js app** (construction takeoff tool). There is one
web service plus a PostgreSQL database. See `README.md` for the full feature
overview and API surface; commands live in `package.json` `scripts`.

### Services
- **Next.js dev server** — `npm run dev` on http://localhost:3000 (client-only
  canvas UI + `/api/*` route handlers).
- **PostgreSQL** — required. Data is stored here; the app will not start pages
  that need data without it.

### Environment already provisioned by the update script + VM snapshot
- Node dependencies are refreshed by the update script (`npm install`, whose
  `postinstall` runs `prisma generate`).
- PostgreSQL 16 is installed in the VM image, with a `plansimple` role
  (password `plansimple`) owning a `plansimple` database.
- `.env` exists at the repo root (gitignored) with `DATABASE_URL`,
  `DATABASE_URL_UNPOOLED`, and a generated `SESSION_SECRET`. `ANTHROPIC_API_KEY`
  is intentionally empty — the app runs fully without it; only the AI Count /
  AI Area features return a 503 until a key is set.

### Non-obvious startup caveats
- **Postgres is not auto-started on boot.** Start it once per VM session before
  running the app or tests that hit the DB:
  `sudo pg_ctlcluster 16 main start`
  (safe to re-run; it no-ops if already running).
- After the DB is up, ensure schema + demo data exist (both idempotent):
  `npx prisma migrate deploy` then `npm run seed`. The seed skips itself if the
  "Demo Office Building" project already exists.
- Local sheet PDFs are written to `./uploads` (from `FILE_STORAGE_DIR`). On
  Vercel this switches to Blob automatically; locally the `uploads/` dir is
  gitignored and lives only on the VM.

### Seeded demo login
- `demo@plansimple.dev` / `plansimple123` — opens a "Demo Office Building"
  project with sheet A-101 (pre-calibrated) and A-102 (uncalibrated).

### Test / build
- `npm test` — vitest, 49 pure-logic tests (geometry / scale / csv). No DB needed.
- No lint script is defined.
- `npm run build` = `prisma generate && next build`. Note `vercel.json`
  overrides the deploy build with `prisma migrate deploy && prisma generate &&
  next build`, which additionally requires the DB reachable.
