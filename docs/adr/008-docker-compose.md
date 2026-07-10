# ADR-008: Docker Compose as local system of record

## Status
Accepted

## Context
Phase 0 acceptance is `docker compose up`. Agent VM initially lacked Docker; `docker.io` installed.

## Decision
All services containerized. Local Postgres uses `pgvector/pgvector:pg16`. Production may use Neon for Postgres while other services run on any Docker host (Coolify-style).

## Consequences
- Parity between local and deployable images
- Neon is a connection-string swap, not a code fork
