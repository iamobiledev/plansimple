# ADR-006: Markup dual-write (Yjs + Postgres)

## Status
Accepted (Phase 3 design; schema ready in Phase 0)

## Context
Construction is liability-sensitive; Postgres must be the system of record. Realtime needs CRDTs.

## Decision
Live session state in Yjs; flush to `markups` with `yjs_origin_id` for idempotency. Audit log records mutations.

## Consequences
- Conflict-free multiplayer
- Flush/reconcile complexity
- Export and workflows always read Postgres
