# PlanSimple Progress

## Current: Vercel + Neon rebuild (in progress)

### Done
- [x] Next.js 15 App Router at `apps/web` (Vite → `legacy/web-vite`)
- [x] Neon Postgres migrations applied + demo seed
- [x] Session auth, orgs, projects, PDF upload, markups, pdf.js viewer
- [x] Local smoke against Neon (`demo@plansimple.dev` / `plansimple123`)
- [x] Partial production deploy → https://plansimple.vercel.app (UI shell only)
- [x] Deploy runbook `docs/runbooks/vercel-neon-deploy.md`

### Remaining for production
- [ ] Full Next.js tree deployed (API routes + viewer) to Motown `plansimple`
- [ ] Vercel env: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`
- [ ] Enable Vercel Blob → `BLOB_READ_WRITE_TOKEN`
- [ ] Set Root Directory to `apps/web` (git-connected) or redeploy full file tree
- [ ] Production smoke: login → org → project → upload PDF → markup

### Demo credentials
`demo@plansimple.dev` / `plansimple123`
