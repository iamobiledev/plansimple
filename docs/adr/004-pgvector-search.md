# ADR-004: pgvector instead of OpenSearch (v1)

## Status
Accepted

## Context
Brief allows OpenSearch or pgvector. We already require Postgres (Neon).

## Decision
Ship semantic + keyword search on Postgres with the `vector` extension. Revisit OpenSearch if scale/query complexity demands it.

## Consequences
- One fewer Compose service
- Neon supports `vector`
- May need OpenSearch later for heavy full-text across huge drawing sets
