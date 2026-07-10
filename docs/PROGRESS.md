# PlanSimple Progress Log

> Update after every work session. Assume the next agent has no memory.

## Current phase
**First-pass foundation complete:** Phase 0 ✅ · Phase 1 vertical slice ✅ · Phases 2–7 scaffolded behind flags ✅  
**Next deep work (when continuing):** Phase 2 markup authoring UI + Tool Chest; tus; OCR worker; Yjs realtime.

## Completed this session
### Phase 0
- Monorepo, NestJS auth/orgs/invites/projects, Drizzle+RLS, Vite UI, CI, ADRs, native-dev fallback.

### Phase 1
- Upload → MinIO → Redis ingest → pypdfium2 tiles + text → Canvas TileViewport + search.
- Ingest callback secured with `x-plansimple-ingest-secret` / `INGEST_CALLBACK_SECRET`.
- Empty-text pages enqueue `plansimple:ocr` (OCR implementation still stub).

### Scaffolding (flags default off)
- **Markups API** CRUD + bulk status + audit log; cloud path generator in `@plansimple/shared`.
- **Sessions API** create/list/end stubs.
- **Workflows API** RFI / submittal / punch-item stubs.
- **AI worker** `/v1/sheet-index`, `/v1/nl-search`, `/v1/draft-rfi` (503 without Anthropic key).
- Web: `FeatureFlagGate`, `MarkupListPanel` (shown when `FEATURE_MARKUP_ENGINE=1`).

### Seed / fixtures
- `scripts/generate-fixture-pdfs.py` → architectural / structural / MEP sets.
- `scripts/seed-drawing-sets.ts` uploads + enqueues ingest.
- All three demo sets processed to `ready` on demo project.

### Tests
- Shared: 52 unit tests.
- RLS: 4/4 with `RUN_DB_TESTS=1`.
- Playwright E2E (`E2E=1`): 3/3 passed (signup, demo login, upload→tiles→text search).

## Known issues
- Docker Compose overlay whiteout fails on this agent VM — use native Postgres/Redis + MinIO binary.
- Full tus / WebGL / OCR / Yjs / Bluebeam-parity markups not done.
- Keep a single API + docproc process; stale processes caused EADDRINUSE / missing routes.

## How to run
```
# Postgres+Redis native, MinIO :9000
export DATABASE_URL=postgresql://plansimple:plansimple@localhost:5432/plansimple
export STORAGE_DRIVER=s3 S3_ENDPOINT=http://127.0.0.1:9000 INGEST_CALLBACK_SECRET=dev-ingest-secret ...
node apps/api/dist/main.js
cd workers/docproc && python3 -m app.main
pnpm --filter @plansimple/web dev
pnpm seed:drawings   # optional re-seed
```
Demo: `demo@plansimple.dev` / `plansimple123`

## Next steps
1. Phase 2: draw tools on TileViewport overlay; Markup List filters/CSV; enable `FEATURE_MARKUP_ENGINE`.
2. tus resumable uploads; per-page SSE progress.
3. OCR worker consuming `plansimple:ocr`.
4. Phase 3 Yjs wiring in `apps/realtime`.
5. Create/merge PR when ready (draft PR may need manual approval in settings).
