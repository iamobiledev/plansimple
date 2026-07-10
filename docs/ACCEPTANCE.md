# Acceptance status (mirrors the plan)

Tracked in detail in `/opt/cursor/artifacts/PLAN.md` and `docs/PROGRESS.md`.

## Phase 0
- [x] Services boot (native fallback on agent VM; Compose committed)
- [x] Signup → org → project → invite
- [x] RLS cross-tenant isolation
- [x] CI workflow + lint/typecheck/test

## Phase 1
- [x] Multi-page upload → tiles → view
- [x] Pan/zoom + text search
- [x] Large fixture generator + manual acceptance runbook

## Phase 2
- [x] Markup types create→persist→reload (×2)
- [x] Markup List filters + CSV
- [x] PDF export original / +markups / flattened
- [ ] PDF annotation re-import as editable objects (future)

## Phase 3
- [x] Two-client Yjs converge (Playwright)
- [x] Disconnect/reconnect converge
- [ ] Full 60s browser offline + mentions/follow (future)

## Phase 4
- [x] Calibration + known room ≤0.5%
- [x] Quantity in Markup List / CSV

## Phase 5
- [x] Revision upload + slip-sheet
- [x] Overlay compare
- [x] Diff hotspots + flagged markups

## Phase 6
- [x] Sheet indexing + NL search + RFI draft (heuristic; Claude optional)
- [ ] 50-sheet ≥90% vision eval / AI takeoff recall (future)

## Phase 7
- [x] Notifications, audit, billing/SSO stubs, export manifest, OWASP/backup/load-test docs
- [ ] Live Stripe + production load test execution (future)
