# PlanSimple — Construction Takeoff in the Browser

PlanSimple is a lightweight, browser-first quantity takeoff tool for construction estimators — think a focused alternative to Bluebeam Revu that does one thing well: measuring quantities off PDF plan sheets, with AI-assisted symbol counting and room detection powered by Claude.

Built as a single **Next.js** application that deploys entirely on **Vercel**.

## What it does

- **Projects & sheets** — create a project, upload PDF plan sets; multi-page PDFs are split into individual sheets with a thumbnail sidebar.
- **PDF viewer** — smooth pan/zoom (wheel + drag, trackpad pinch) with a Konva annotation layer that stays perfectly in sync with the PDF render layer.
- **Scale calibration** — draw a line over a known dimension (e.g. a `20'-0"` string), type the real length, and the sheet is calibrated. Imperial (`20'-6"`, `6"`) and metric (`5m`, `250mm`) input both parse. Recalibrating a sheet recomputes all of its existing measurements.
- **Measurement tools**
  - *Linear* — click points along a wall/pipe run, double-click or Enter to finish; live running-length label while drawing.
  - *Area* — click polygon vertices, double-click/Enter to close; computed area shown, vertices editable after the fact.
  - *Count* — click to drop markers; each marker is one unit of the active item, rendered with the item's custom icon if one is set.
  - Every measurement belongs to a **takeoff item** (e.g. "Interior Wall — 5/8\" Drywall") with a name, color, type, unit, optional unit cost, and (for counts) an optional custom marker icon.
  - Select a measurement to see its value, drag its vertices, or delete it. Undo/redo (Ctrl+Z / Ctrl+Shift+Z) covers add, edit, and delete.
- **Item library & custom icons** — save takeoff items to a personal library and add them to any project in one click; upload PNG/SVG/JPEG marker icons (max 1 MB) for count items.
- **Project details** — each project carries a site address and client name, shown on project cards and exported documents.
- **Branded PDF export** — one click produces a customer-ready PDF: a cover page with the project name, client, address, date, and a quantity summary table, followed by every plan sheet with color-coded vector measurement overlays, quantity labels, a takeoff legend, and a footer stamp. Generated entirely client-side with pdf-lib (no server time limits).
- **AI-assisted takeoff** (requires `ANTHROPIC_API_KEY`)
  - *AI Count* — drag a box around one example symbol (a receptacle, a door tag…); the sheet image plus the cropped example are sent to Claude, which returns candidate locations. Candidates render as ghost markers — click to reject bad ones, then Accept. Nothing is committed without confirmation.
  - *AI Area* — click inside a room; Claude traces the enclosed boundary and returns a ghost polygon whose vertices you can drag before accepting.
- **Quantity summary & export** — live summary of every condition (quantity, unit, extended cost), roll-up or per-sheet grouping, CSV export.

## Quick start (local)

Prerequisites: **Node 20+**, **PostgreSQL 14+**.

```bash
# 1. Install dependencies (postinstall runs prisma generate)
npm install

# 2. Configure
cp .env.example .env
# edit .env — at minimum DATABASE_URL; add ANTHROPIC_API_KEY for AI features

# 3. Create the database schema
npm run db:migrate        # or: npm run db:push

# 4. Seed demo data (demo user, project, generated sample floor plan)
npm run seed

# 5. Run the app on http://localhost:3000
npm run dev
```

Sign in with the seeded account:

```
demo@plansimple.dev / plansimple123
```

The seed creates a "Demo Office Building" project with a two-page generated plan set. Sheet **A-101** is pre-calibrated so you can measure immediately; sheet **A-102** is left uncalibrated so you can try the Calibrate tool against its `30'-0"` dimension string.

No local Postgres? One command with Docker:

```bash
docker run -d --name plansimple-db -p 5432:5432 \
  -e POSTGRES_USER=plansimple -e POSTGRES_PASSWORD=plansimple -e POSTGRES_DB=plansimple \
  postgres:16
```

## Deploying to Vercel

The app is designed to run entirely on Vercel: Next.js route handlers for the API, a hosted Postgres for data, and Vercel Blob for sheet PDFs (serverless filesystems are ephemeral, so the storage layer switches to Blob automatically when a Blob store is connected).

1. **Push this repo to GitHub** and import it in [vercel.com/new](https://vercel.com/new) (or run `npx vercel` from the repo). Next.js is auto-detected; no build settings needed.
2. **Database** — create a Postgres database (Vercel Marketplace → Neon, or any hosted Postgres) and set `DATABASE_URL` in the project's environment variables. Use the **pooled** connection string for serverless.
3. **Blob storage** — in the Vercel project: Storage → Create → Blob, and connect it. Vercel injects `BLOB_READ_WRITE_TOKEN` automatically; the app detects it and stores PDFs in Blob.
4. **Environment variables** — set `SESSION_SECRET` (32+ chars, `openssl rand -base64 32`) and optionally `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` for the AI features.
5. **Migrate & seed** — run once against the production database from your machine:
   ```bash
   DATABASE_URL="<prod pooled url>" npx prisma migrate deploy
   DATABASE_URL="<prod url>" BLOB_READ_WRITE_TOKEN="<token>" npm run seed   # optional demo data
   ```
   (Alternatively set the Vercel build command to `prisma migrate deploy && prisma generate && next build` to migrate on deploy.)

### Vercel platform notes

- **Upload size** — Vercel serverless functions cap request bodies at ~4.5 MB, so PDF uploads above that fail in production (local dev is unaffected). The clean fix for large plan sets is client-side upload straight to Blob (`@vercel/blob/client`) — planned, not yet built.
- **Function duration** — the AI and upload routes declare `maxDuration = 60`; vision calls over a full sheet typically take 10–30 s.
- **Sessions** are stateless encrypted cookies (iron-session), so no session store is needed across serverless invocations.
- **Blob privacy** — Vercel Blob URLs are public but unguessable (UUID keys); the app only ever hands clients the auth-gated `/api/files/[key]` route.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (pooled, for serverless) |
| `SESSION_SECRET` | recommended | 32+ char secret for iron-session cookie encryption |
| `ANTHROPIC_API_KEY` | for AI features | Claude API key. Everything else works without it; AI endpoints return a clear 503 if unset |
| `ANTHROPIC_MODEL` | no | Vision model for AI takeoff (default `claude-opus-4-8`) |
| `BLOB_READ_WRITE_TOKEN` | on Vercel | Injected by the connected Blob store; switches file storage from local disk to Vercel Blob |
| `FILE_STORAGE_DIR` | no | Local-dev PDF directory (default `./uploads`) |

## Tests

```bash
npm test          # vitest — geometry, scale/unit parsing, CSV summary logic (49 tests)
```

The measurement math is deliberately isolated from the UI in pure, unit-tested modules:

- `src/lib/geometry.ts` — polyline length, shoelace polygon area, perimeter, centroid
- `src/lib/scale.ts` — calibration, pixel↔real-world conversion, imperial/metric parsing & formatting
- `src/lib/csv.ts` — quantity summary aggregation and CSV serialization
- `src/lib/exportPdf.ts` — branded takeoff PDF builder (cover page + vector sheet overlays)

## Architecture

```
plansimple/
├── prisma/                  schema (User/Project/Sheet/Condition/Measurement),
│                            migrations, seed (generates a demo plan PDF with pdf-lib)
└── src/
    ├── app/
    │   ├── page.tsx           client-only entry (dynamic import, no SSR for canvas code)
    │   └── api/               route handlers: auth, projects, sheets, conditions,
    │                          measurements, ai/count, ai/suggest-area, files
    ├── server/                server-only modules
    │   ├── db.ts                Prisma singleton
    │   ├── session.ts           iron-session (stateless encrypted cookies)
    │   ├── storage.ts           FileStorage: LocalDiskStorage | VercelBlobStorage
    │   ├── pdf-split.ts         multi-page PDF → per-sheet single-page PDFs
    │   └── ai.ts                Anthropic client + vision helpers
    ├── lib/                   pure math (tested): geometry, scale, csv
    ├── pdf.ts                 pdf.js: page rendering, thumbnails, AI snapshots
    ├── store.ts               zustand: optimistic CRUD, undo/redo command stack
    └── components/            Viewer (Konva), sidebars, toolbar, dialogs
```

### Key design decisions

- **Coordinate system** — all geometry is stored in *PDF base coordinates* (the page viewport at scale 1). Zoom/pan never changes stored data; `Sheet.scalePixelsPerUnit` maps base pixels to feet or meters.
- **Sheet splitting** — on upload, each PDF page is physically split into its own single-page PDF (pdf-lib) and stored via the `FileStorage` interface, so each `Sheet` row has its own `fileUrl`.
- **One Konva stage, two layers** — the rendered PDF page is a Konva image on a non-interactive layer beneath the annotation layer, so pan/zoom sync is free and hit-testing only sees measurements.
- **Optimistic UI + undo/redo** — measurements appear instantly with a temp id, persist in the background, and the id is swapped on response. Undo/redo is a command stack; since re-creating a deleted measurement yields a new server id, commands resolve ids through an alias map.
- **Counts are individual rows** — each count click is its own `Measurement` (one point, value 1), which makes select/move/delete/undo uniform across all three tool types.
- **AI is suggestion-only** — Claude returns candidate coordinates (count) or a polygon (area) in image pixel space; the client maps them back to base coordinates and renders ghosts. A human accepts or rejects every suggestion; accepted ghosts become ordinary measurements flagged `source: "ai"`.
- **Recalibration is retroactive** — changing a sheet's scale recomputes and re-persists `computedValue` for every linear/area measurement on that sheet from stored geometry.

### API surface

All endpoints are session-authenticated JSON route handlers under `/api`:

```
POST /api/auth/register|login|logout   GET /api/auth/me
GET|POST /api/projects                 GET|DELETE /api/projects/[id]
GET  /api/projects/[id]/measurements   (project-wide, for the summary)
POST /api/sheets/upload/[projectId]    (multipart PDF; splits into sheets)
PATCH|DELETE /api/sheets/[id]          GET /api/sheets/[id]/measurements
POST /api/conditions/project/[id]      PATCH|DELETE /api/conditions/[id]
POST /api/measurements                 PATCH|DELETE /api/measurements/[id]
POST /api/ai/count                     POST /api/ai/suggest-area
GET|POST /api/library                  PATCH|DELETE /api/library/[id]
GET|POST /api/icons                    DELETE /api/icons/[id]
GET  /api/files/[key]                  (auth-gated sheet PDFs & icons)
```

## Out of scope (MVP)

Real-time collaboration, payments, mobile apps, full markup suite (clouds/callouts/stamps), sheet version compare, OCR auto-calibration, and direct-to-Blob client uploads for >4.5 MB plan sets are intentionally not built yet.
