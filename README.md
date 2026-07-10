# PlanSimple

Cloud-native construction document collaboration — view, mark up, measure, compare, and collaborate on drawing sets in the browser, with AI-assisted takeoff and workflows.

> Rebuilt as a pnpm monorepo (NestJS API, Vite web, Yjs realtime, Python workers). Neon-compatible Postgres with RLS. Local stack via Docker Compose.

## Quick start

### Prerequisites
- Node 22+, pnpm 10+
- Docker + Docker Compose

```bash
cp .env.example .env
pnpm install
docker compose up --build -d postgres redis minio minio-init mailpit
pnpm --filter @plansimple/shared build
pnpm --filter @plansimple/api db:migrate
pnpm --filter @plansimple/api seed
pnpm --filter @plansimple/api dev   # :3000
pnpm --filter @plansimple/web dev   # :5173
```

Or bring up the full stack:

```bash
docker compose up --build
```

Demo login (after seed):

```
demo@plansimple.dev / plansimple123
```

### Neon (production Postgres)

Set both:

- `DATABASE_URL` — pooled connection string
- `DATABASE_URL_UNPOOLED` — direct URL for migrations

Run `pnpm db:migrate` against the unpooled URL before deploy.

## Monorepo layout

```
apps/web        Vite + React PlanSimple UI
apps/api        NestJS API gateway (auth, orgs, projects, …)
apps/realtime   Yjs / presence WebSocket server
workers/docproc Python: ingest, tiles, OCR
workers/ai      Python: Claude + embeddings
packages/shared Zod schemas + geometry/scale/csv
docs/           PROGRESS.md + ADRs
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Turbo parallel dev |
| `pnpm build` | Build all packages |
| `pnpm test` | Unit/integration tests |
| `pnpm db:migrate` | Apply SQL migrations |
| `pnpm seed` | Seed demo user/org/project |

## Phase status

See [`docs/PROGRESS.md`](docs/PROGRESS.md). Architecture decisions live in [`docs/adr/`](docs/adr/).

## License

Proprietary — all rights reserved.
