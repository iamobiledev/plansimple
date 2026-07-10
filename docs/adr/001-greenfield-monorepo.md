# ADR-001: Greenfield monorepo replaces Next.js app

## Status
Accepted

## Context
PlanSimple began as a Next.js + Prisma + pdf.js + Konva takeoff MVP on Vercel. The product brief requires NestJS, FastAPI workers, PDFium tile viewports, Yjs realtime, MinIO, and Postgres RLS — incompatible with evolving the monolith in place.

## Decision
Rebuild as a pnpm + Turborepo monorepo. Salvage pure domain math (`geometry`, `scale`, `csv`) into `@plansimple/shared`. Delete the Next.js app.

## Consequences
- Faster alignment with the target architecture
- Temporary loss of the old MVP UI until Phase 0–1 lands
- Neon remains the production Postgres provider via connection strings
