# PlanSimple (Vercel + Neon)

Browser-first construction document collaboration. Production target: **Vercel** + **Neon Postgres** + **Vercel Blob**.

## Local

```bash
pnpm install
cp .env.example apps/web/.env.local   # set Neon URLs + SESSION_SECRET
pnpm --filter @plansimple/shared build
pnpm --filter @plansimple/web db:migrate
pnpm --filter @plansimple/web seed
pnpm --filter @plansimple/web dev     # http://localhost:3000
```

Demo: `demo@plansimple.dev` / `plansimple123`

## Vercel

1. Project root directory: `apps/web`
2. Connect Neon env vars + Blob store
3. Build uses pnpm workspace (see `apps/web/vercel.json`)
4. Run migrations once: `DATABASE_URL_UNPOOLED=... pnpm --filter @plansimple/web db:migrate`

## Architecture notes

- Next.js App Router for UI + API
- Soft realtime (SSE/polling) — no dedicated WS server
- pdf.js client viewer (serverless-friendly)
- Legacy Docker/Nest stack kept under `legacy/` and `apps/api` for reference
