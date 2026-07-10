# ADR-012: Neon-compatible Postgres in production

## Status
Accepted

## Context
Owner is a Neon customer. Core paths must stay vendor-neutral for Coolify/Docker hosts. PlanetScale (MySQL) cannot provide Postgres RLS + pgvector.

## Decision
- Local: Docker `pgvector/pgvector:pg16`
- Production: Neon Postgres via `DATABASE_URL` (pooled) + `DATABASE_URL_UNPOOLED` (migrations)
- No Neon-specific SDK in core application code

## Consequences
- Same SQL/migrations everywhere
- Document Neon PITR in runbooks (Phase 7)
