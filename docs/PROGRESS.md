# PlanSimple Progress Log

> Update after every work session. Assume the next agent has no memory.

## Current phase
**Phase 3 — Real-time Sessions** vertical slice landed (Yjs server + client + CRDT converge test).  
Phases 0–2 largely complete.

## Completed
### Phase 3 (this turn)
- `apps/realtime`: y-websocket-compatible sync + awareness server; Redis pub/sub fan-out; Postgres `yjs_documents` persistence.
- Web: `useCollabRoom` (Y.Doc + WebsocketProvider), peer avatars, live connection indicator; markups published to Y.Map after API create (dual-write path).
- `realtime_sessions` feature flag default **true** (override `FEATURE_REALTIME_SESSIONS=0`).
- Unit: Yjs two-doc converge test ✅
- WS smoke: connect to room, receive sync/awareness frames ✅

### Phase 2 (prior)
Draw tools, Markup List/CSV, Tool Chest, stamp, PDF export modes, round-trip tests.

### Phase 0–1 (prior)
Monorepo, auth/RLS, tile ingest/viewer, seed sets, E2E.

## Still open for full Phase 3 acceptance
- Playwright two-browser concurrent markup converge + 60s offline reconnect.
- Follow-user / viewport indicators.
- Comment @mentions + notifications.
- Session activity report export.
- Host permission restrictions in-session.

## Demo
`demo@plansimple.dev` / `plansimple123` — open a sheet with two browsers; Live indicator should show peers when both connected to same revision room.

Realtime: `ws://127.0.0.1:1234` · API `:3000` · Web `:5173`

## Next steps
1. Playwright multiplayer converge E2E.
2. Phase 4 measurement tools + calibration.
3. Offline reconnect stress test.
