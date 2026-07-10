# Deploy PlanSimple to Vercel + Neon

## 1. Vercel project settings (Motown / plansimple)

- Framework: **Next.js**
- Root Directory: `apps/web`
- Install Command: `cd ../.. && pnpm install`
- Build Command: `cd ../.. && pnpm --filter @plansimple/shared build && pnpm --filter @plansimple/web build`
- Output: Next default

Or deploy the standalone `apps/web` tree (no workspace) with Root Directory `.`

## 2. Environment variables (Production + Preview)

```
DATABASE_URL=postgresql://neondb_owner:...@ep-icy-frog-atam6ryq-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://neondb_owner:...@ep-icy-frog-atam6ryq.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require
SESSION_SECRET=<32+ random chars>
NEXT_PUBLIC_APP_URL=https://plansimple.vercel.app
```

Optional:
```
BLOB_READ_WRITE_TOKEN=<from Vercel Blob store>
ANTHROPIC_API_KEY=
```

## 3. Vercel Blob

Project → Storage → Create Blob store → connect to `plansimple`.

## 4. Migrations

Already applied to Neon from this agent. To re-run:

```bash
DATABASE_URL_UNPOOLED=... pnpm --filter @plansimple/web db:migrate
DATABASE_URL=... pnpm --filter @plansimple/web seed
```

## 5. Demo login

`demo@plansimple.dev` / `plansimple123`
