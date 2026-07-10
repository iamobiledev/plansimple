# ADR-003: Drizzle ORM + SQL migrations

## Status
Accepted

## Context
Multi-tenant RLS requires first-class SQL policies. Prisma makes RLS awkward (middleware vs session vars).

## Decision
Use Drizzle for typed queries and checked-in SQL migrations (`apps/api/drizzle/*.sql`) applied by `tsx src/db/migrate.ts`. Runtime uses `DATABASE_URL` (pooled); migrations use `DATABASE_URL_UNPOOLED` (Neon-compatible).

## Consequences
- Explicit RLS policies in SQL
- Slightly more SQL ownership than Prisma migrate
