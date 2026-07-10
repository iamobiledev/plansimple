# ADR-002: pnpm workspaces + Turborepo

## Status
Accepted

## Context
Need multi-package builds (web, api, realtime, shared) with shared types and CI caching.

## Decision
Use pnpm workspaces and Turborepo for `build` / `lint` / `typecheck` / `test` pipelines.

## Consequences
- Consistent `@plansimple/*` package names
- Requires `packageManager` field and lockfile committed
