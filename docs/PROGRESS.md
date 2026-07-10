# PlanSimple Progress Log

> Update after every work session. Assume the next agent has no memory.

## Current phase
**Phase 1 — Document ingestion & tile viewer** (vertical slice proven)
**Next: deepen Phase 1 (tus, OCR queue, WebGL, large fixtures) then Phase 2 markups**

## Completed
### Phase 0
- Greenfield pnpm monorepo; NestJS auth/orgs/invites/projects; Drizzle+RLS; Vite UI; workers skeletons; CI; ADRs 001–012.
- RLS 4/4; signup→org→project→invite→accept proven.
- Native Postgres fallback (Compose overlay whiteout blocked on agent VM).

### Phase 1 vertical slice
- Documents API: initiate upload, multipart upload, complete, list/get, tile metadata, ingest callback.
- Storage: MinIO (S3) + local driver; auth-gated object proxy.
- Docproc worker: pypdfium2 → 512px WebP tile pyramid z=0..4 + text.json spans; Redis queue `plansimple:ingest`.
- Web: ProjectPage upload + polling + `TileViewport` (Canvas tiles, pan/zoom, text search highlights).
- Feature flags endpoint (post-Phase-2 defaults off).
- **Acceptance:** upload `scripts/fixtures/sample-plans.pdf` → 3 pages ready → tile WebP 200 OK → text search finds `SEARCHABLE` / roof drain token.
  - Evidence: `/opt/cursor/artifacts/phase1-tile-z0.webp`, `phase1-text-layer.json`, `phase1-document-detail.json`.

## In flight
- Full tus protocol (multipart convenience path works now).
- OCR for image-only pages.
- WebGL2 renderer (Canvas2D works for slice).
- 300-page/800MB manual fixture script.

## Known issues / decisions
- Brand **PlanSimple**; Neon prod Postgres; pgvector search.
- Docker Compose pull fails overlay whiteout on this VM — use MinIO binary + native Postgres/Redis (`docs/runbooks/native-dev-fallback.md`).
- Auth token issuance must be outside user-insert transaction.
- Ingest callback uses `@Public()` — add shared secret before production.
- Text extract merges chars; search token may split across spans (hit on `SEARCHABLE` substring OK for slice).

## How to run (agent VM)
```
# MinIO already at :9000; Postgres/Redis native
export DATABASE_URL=postgresql://plansimple:plansimple@localhost:5432/plansimple
export STORAGE_DRIVER=s3 S3_ENDPOINT=http://127.0.0.1:9000 ...
node apps/api/dist/main.js
cd workers/docproc && python3 -m app.main
pnpm --filter @plansimple/web dev
```
Demo: `demo@plansimple.dev` / `plansimple123`

## Next steps
1. Harden ingest callback auth; add per-page progress events (SSE/WS).
2. tus resumable uploads + signed URL browser PUT path.
3. OCR queue for empty-text pages.
4. Phase 2 markup engine scaffold (cloud tool first).
5. Playwright E2E: upload → search.
6. Open PR when Phase 1 slice is considered mergeable.
