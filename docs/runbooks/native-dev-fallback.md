# Native / agent-VM fallback (when Docker overlay extract fails)

## Context
On some cloud agent VMs, `docker compose pull/up` fails with:

```
failed to convert whiteout file ... operation not permitted
```

Compose files and Dockerfiles remain the source of truth for Coolify-style deploys.

## Local agent workaround
1. Install Postgres 16 + `postgresql-16-pgvector` + Redis.
2. Create role/db `plansimple` / `plansimple`.
3. `pnpm install && ./scripts/dev-native.sh`
4. Run API + web in separate terminals.

## Production
Use Neon for Postgres (`DATABASE_URL` + `DATABASE_URL_UNPOOLED`) and run container images for api/web/realtime/workers/minio/redis on any Docker host.
