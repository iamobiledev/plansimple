# Backup & restore (Postgres + object storage)

## Postgres (Neon production)

1. Prefer **Neon point-in-time recovery (PITR)** from the Neon console.
2. Application uses:
   - `DATABASE_URL` — pooled (runtime)
   - `DATABASE_URL_UNPOOLED` — direct (migrations)
3. After restore: run `pnpm db:migrate` if schema drifted; re-seed only for demos.

### Logical dump (any Postgres)

```bash
pg_dump "$DATABASE_URL_UNPOOLED" -Fc -f plansimple-$(date +%F).dump
# restore
pg_restore -d "$DATABASE_URL_UNPOOLED" --clean --if-exists plansimple-YYYY-MM-DD.dump
```

## Object storage (MinIO / S3 / R2)

- Enable **versioning** on the `plansimple` bucket in production.
- Revisions are immutable keys under `orgs/.../revisions/{id}/original.pdf` and tile pyramids.
- Mirror with `mc mirror` or S3 replication for DR.

```bash
mc mirror local/plansimple backup/plansimple
```

## Application config

- Back up `.env` secrets via your secret manager (not git).
- Document Stripe / OAuth / Anthropic keys separately.

## Verify restore

1. `GET /api/health` → db true
2. Login demo or admin
3. Open a project; confirm documents + tiles load
4. Spot-check markups and audit log
