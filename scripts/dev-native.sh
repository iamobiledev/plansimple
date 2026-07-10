#!/usr/bin/env bash
# Native fallback when Docker overlayfs is unavailable in the agent VM.
# Starts local Postgres/Redis expectations are already met; runs migrate + seed + API/web.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DATABASE_URL="${DATABASE_URL:-postgresql://plansimple:plansimple@localhost:5432/plansimple}"
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-change-me-access-secret-at-least-32-chars!!}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-change-me-refresh-secret-at-least-32-chars!}"
export PUBLIC_WEB_URL="${PUBLIC_WEB_URL:-http://localhost:5173}"
export PUBLIC_API_URL="${PUBLIC_API_URL:-http://localhost:3000}"
export API_PORT="${API_PORT:-3000}"

pnpm --filter @plansimple/shared build
pnpm --filter @plansimple/api db:migrate
pnpm --filter @plansimple/api seed

echo "Start API:  pnpm --filter @plansimple/api dev"
echo "Start web:  pnpm --filter @plansimple/web dev"
echo "Demo: demo@plansimple.dev / plansimple123"
