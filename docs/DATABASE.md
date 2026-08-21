# Database Operations

FaithHaven uses PostgreSQL 16. The API refuses to connect without `DATABASE_URL`, and the migration runner applies ordered SQL files from `backend/migrations/` using the `schema_migrations` ledger.

## Migrations

```bash
cd backend
DATABASE_URL='postgresql://...' npm run migrate
```

Migrations are forward-only in normal operations. Test every migration with a production-shaped restore before release. Do not edit an already-applied migration; add a new ordered migration instead.

## Backup

Run a daily encrypted logical backup from the VPS or a managed backup system. A manual example is:

```bash
docker compose --env-file .env.production exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > faithhaven-$(date +%F).dump
```

Store backups outside the VPS with encryption, least-privilege access, retention controls, and periodic restore tests. Backups contain sensitive account and prayer data.

## Restore verification

Restore only into an isolated database first:

```bash
pg_restore --clean --if-exists --no-owner --dbname='postgresql://restore-user:password@host:5432/faithhaven_restore' faithhaven-YYYY-MM-DD.dump
```

Then run schema checks, health checks, an authentication smoke test, and a sample read-only content request. Document the restore timestamp and result. The production recovery objective should be set by the operator; it is not inferred by this repository.
