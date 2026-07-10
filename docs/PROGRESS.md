# PlanSimple Progress Log

> Update after every work session. Assume the next agent has no memory.

## Current phase
**Phase 0 — Foundation** (acceptance proven via native Postgres; Compose files present)
**Next: Phase 1 — Document ingestion & tile viewer**

## Completed
- User approved greenfield monorepo, pgvector, Drizzle, Neon prod DB, PlanSimple branding, Phase 0→1 focus.
- Removed Next.js/Prisma/Vercel monolith; salvaged geometry/scale/csv into `@plansimple/shared` (49 unit tests passing).
- Scaffolded pnpm + Turborepo monorepo: `apps/web`, `apps/api`, `apps/realtime`, `workers/docproc`, `workers/ai`, `packages/shared`.
- NestJS API: JWT auth (access + refresh cookie), orgs, invitations, projects, health/metrics.
- Drizzle schema + SQL migration `0000_init.sql` with **FORCE ROW LEVEL SECURITY**; RLS tests pass (`RUN_DB_TESTS=1` → 4/4).
- **API acceptance proven:** register → create org → create project → invite → accept invite → demo login.
- Vite PlanSimple UI + realtime/worker skeletons + CI workflow + ADRs 001–012 + README.
- Docker Engine installed; Compose/Dockerfiles committed.
- Native fallback runbook + `scripts/dev-native.sh` (agent VM cannot extract some OCI whiteout layers).

## In flight
- Phase 1 vertical slice: tus upload, docproc tiles, TileViewport.

## Known issues / decisions
- Brand is **PlanSimple** (not Struct).
- Search v1 = **pgvector**; Prod DB = **Neon** (`DATABASE_URL` + `DATABASE_URL_UNPOOLED`).
- **Docker Compose `up` fails on this agent VM** with overlayfs whiteout `operation not permitted` while pulling images. Substitution: native Postgres 16 + pgvector + Redis; Compose remains deploy path. See `docs/runbooks/native-dev-fallback.md`.
- Nested DB transactions: token issuance must run *after* user insert commits (fixed in AuthService).
- Ambiguity rule: match Bluebeam Revu; log here.

## Next steps
1. Phase 1: documents module + MinIO signed upload + docproc tile pipeline + web TileViewport.
2. Wire web E2E against running API when convenient.
3. Optional: retry Compose on a host without overlay whiteout restrictions.

## Demo credentials (after seed)
- `demo@plansimple.dev` / `plansimple123`
