# Security review checklist (OWASP Top 10 — PlanSimple)

Status legend: ✅ addressed in code · 🟡 partial / stub · ❌ not yet

| # | Risk | Status | Notes |
|---|---|---|---|
| A01 | Broken Access Control | ✅ | JWT guards + org role checks; Postgres RLS FORCE on tenant tables |
| A02 | Cryptographic Failures | ✅ | bcrypt password hashes; JWT secrets via env; refresh token hashed at rest |
| A03 | Injection | ✅ | Parameterized SQL (Drizzle/pg); Zod at API boundaries |
| A04 | Insecure Design | 🟡 | Dual-write Yjs→Postgres; audit log; AI verify-me — continue threat modeling |
| A05 | Security Misconfiguration | 🟡 | `.env.example` documented; harden CORS/CSP in prod deploy |
| A06 | Vulnerable Components | 🟡 | Run `pnpm audit` / Dependabot in CI; pin versions |
| A07 | Auth Failures | ✅ | Refresh rotation; invite tokens; SSO stubs only |
| A08 | Software/Data Integrity | 🟡 | Immutable revisions; signed ingest callback secret |
| A09 | Logging/Monitoring | 🟡 | Nest logs + audit_log; add OpenTelemetry exporters in prod |
| A10 | SSRF | 🟡 | AI/worker URLs from env; do not accept user-controlled fetch URLs |

## Always
- Signed URLs / auth-gated `/api/storage/object`
- Rate limiting (add Nest throttler before public launch)
- Never commit secrets; rotate `INGEST_CALLBACK_SECRET` / JWT secrets
