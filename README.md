# PlanSimple — Construction Takeoff in the Browser

PlanSimple is a lightweight, browser-first quantity takeoff tool for construction estimators — think a focused alternative to Bluebeam Revu that does one thing well: measuring quantities off PDF plan sheets, with AI-assisted symbol counting and room detection powered by Claude.

![Stack](https://img.shields.io/badge/stack-React%20%2B%20Express%20%2B%20Prisma-3b82c4)

## What it does

- **Projects & sheets** — create a project, upload PDF plan sets; multi-page PDFs are split into individual sheets with a thumbnail sidebar.
- **PDF viewer** — smooth pan/zoom (wheel + drag, trackpad pinch) with a Konva annotation layer that stays perfectly in sync with the PDF render layer.
- **Scale calibration** — draw a line over a known dimension (e.g. a `20'-0"` string), type the real length, and the sheet is calibrated. Imperial (`20'-6"`, `6"`) and metric (`5m`, `250mm`) input both parse. Recalibrating a sheet recomputes all of its existing measurements.
- **Measurement tools**
  - *Linear* — click points along a wall/pipe run, double-click or Enter to finish; live running-length label while drawing.
  - *Area* — click polygon vertices, double-click/Enter to close; computed area shown, vertices editable after the fact.
  - *Count* — click to drop markers; each marker is one unit of the active condition.
  - Every measurement belongs to a **condition** (e.g. "Interior Wall — 5/8\" Drywall") with a name, color, type, unit, and optional unit cost.
  - Select a measurement to see its value, drag its vertices, or delete it. Undo/redo (Ctrl+Z / Ctrl+Shift+Z) covers add, edit, and delete.
- **AI-assisted takeoff** (requires `ANTHROPIC_API_KEY`)
  - *AI Count* — drag a box around one example symbol (a receptacle, a door tag…); the sheet image plus the cropped example are sent to Claude, which returns candidate locations. Candidates render as ghost markers — click to reject bad ones, then Accept. Nothing is committed without confirmation.
  - *AI Area* — click inside a room; Claude traces the enclosed boundary and returns a ghost polygon whose vertices you can drag before accepting.
- **Quantity summary & export** — live summary of every condition (quantity, unit, extended cost), roll-up or per-sheet grouping, CSV export.

## Quick start

Prerequisites: **Node 20+**, **PostgreSQL 14+**.

```bash
# 1. Install dependencies (npm workspaces: server + client)
npm install

# 2. Configure the server
cp server/.env.example server/.env
# edit server/.env — at minimum DATABASE_URL; add ANTHROPIC_API_KEY for AI features

# 3. Create the database schema
npm run db:migrate        # or: npm run db:push

# 4. Seed demo data (demo user, project, generated sample floor plan)
npm run seed

# 5. Run both servers (API on :4000, Vite on :5173)
npm run dev
```

Open **http://localhost:5173** and sign in with the seeded account:

```
demo@plansimple.dev / plansimple123
```

The seed creates a "Demo Office Building" project with a two-page generated plan set. Sheet **A-101** is pre-calibrated so you can measure immediately; sheet **A-102** is left uncalibrated so you can try the Calibrate tool against its `30'-0"` dimension string.

If you don't have a local Postgres, a database is one command away with Docker:

```bash
docker run -d --name plansimple-db -p 5432:5432 \
  -e POSTGRES_USER=plansimple -e POSTGRES_PASSWORD=plansimple -e POSTGRES_DB=plansimple \
  postgres:16
```

## Environment variables

All server configuration lives in `server/.env` (see `server/.env.example`):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string, e.g. `postgresql://plansimple:plansimple@localhost:5432/plansimple` |
| `SESSION_SECRET` | recommended | Secret for signing session cookies (defaults to a dev value) |
| `ANTHROPIC_API_KEY` | for AI features | Claude API key. Everything except AI Count / AI Area works without it; AI endpoints return a clear 503 if unset |
| `ANTHROPIC_MODEL` | no | Vision model for AI takeoff (default `claude-opus-4-8`) |
| `PORT` | no | API port (default `4000`; the Vite dev server proxies `/api` there) |
| `FILE_STORAGE_DIR` | no | Where sheet PDFs are stored (default `server/uploads`) |

## Tests

```bash
npm test          # vitest — geometry, scale/unit parsing, CSV summary logic (49 tests)
```

The measurement math is deliberately isolated from the UI in pure, unit-tested modules:

- `client/src/lib/geometry.ts` — polyline length, shoelace polygon area, perimeter, centroid
- `client/src/lib/scale.ts` — calibration, pixel↔real-world conversion, imperial/metric parsing & formatting
- `client/src/lib/csv.ts` — quantity summary aggregation and CSV serialization

## Architecture

```
plansimple/
├── server/                  Express + Prisma API (TypeScript, ESM)
│   ├── prisma/schema.prisma   User / Project / Sheet / Condition / Measurement
│   ├── prisma/seed.ts         demo data + generates a sample floor-plan PDF with pdf-lib
│   └── src/
│       ├── index.ts           app entry: express-session auth, routes
│       ├── routes/            auth, projects, sheets, conditions, measurements, ai, files
│       └── storage/storage.ts FileStorage interface + LocalDiskStorage (S3-swappable)
└── client/                  React + Vite SPA
    └── src/
        ├── lib/               pure math (tested): geometry, scale, csv
        ├── pdf.ts             pdf.js: page rendering, thumbnails, AI snapshots
        ├── store.ts           zustand store: optimistic CRUD, undo/redo command stack
        └── components/        Viewer (Konva), sidebars, toolbar, dialogs
```

### Key design decisions

- **Coordinate system** — all geometry is stored in *PDF base coordinates* (the page viewport at scale 1). Zoom/pan never changes stored data; `Sheet.scalePixelsPerUnit` maps base pixels to feet or meters.
- **Sheet splitting** — on upload, each PDF page is physically split into its own single-page PDF (pdf-lib) and stored via the `FileStorage` interface, so each `Sheet` row has its own `fileUrl`. Swap `LocalDiskStorage` for an S3 implementation later without touching routes.
- **One Konva stage, two layers** — the rendered PDF page is a Konva image on a non-interactive layer beneath the annotation layer, so pan/zoom sync is free and hit-testing only sees measurements.
- **Optimistic UI + undo/redo** — measurements appear instantly with a temp id, persist in the background, and the id is swapped on response. Undo/redo is a command stack; since re-creating a deleted measurement yields a new server id, commands resolve ids through an alias map.
- **Counts are individual rows** — each count click is its own `Measurement` (one point, value 1), which makes select/move/delete/undo uniform across all three tool types.
- **AI is suggestion-only** — Claude returns candidate coordinates (count) or a polygon (area) in image pixel space; the client maps them back to base coordinates and renders ghosts. A human accepts or rejects every suggestion; accepted ghosts become ordinary measurements flagged `source: "ai"`.
- **Recalibration is retroactive** — changing a sheet's scale recomputes and re-persists `computedValue` for every linear/area measurement on that sheet from stored geometry.

### API surface

All endpoints are session-authenticated JSON under `/api`:

```
POST /api/auth/register|login|logout   GET /api/auth/me
GET|POST /api/projects                 GET|DELETE /api/projects/:id
GET  /api/projects/:id/measurements    (project-wide, for the summary)
POST /api/sheets/upload/:projectId     (multipart PDF; splits into sheets)
PATCH|DELETE /api/sheets/:id           GET /api/sheets/:id/measurements
POST /api/conditions/project/:id       PATCH|DELETE /api/conditions/:id
POST /api/measurements                 PATCH|DELETE /api/measurements/:id
POST /api/ai/count                     POST /api/ai/suggest-area
GET  /api/files/:key                   (auth-gated sheet PDFs)
```

## Out of scope (MVP)

Real-time collaboration, payments, mobile apps, full markup suite (clouds/callouts/stamps), sheet version compare, and OCR auto-calibration are intentionally not built.
