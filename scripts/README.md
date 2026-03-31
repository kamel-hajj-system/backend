# Database scripts

Shared scripts for database setup and schema sync. Use these so all modules (users now, others later) behave the same.

## Env

- **scripts/lib/db-env.js** – `ensureDatabaseUrl(envPath?)`. Loads `.env` and sets `DATABASE_URL` from `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`/`PGPORT`/`DB_SSL` if `DATABASE_URL` is not set. Use at the start of any script that uses Prisma or DB.

## Commands (from backend root)

- **npm run db:ensure** – Run `prisma migrate deploy` (pending migrations in order), then continue.
- **npm run db:seed** – Ensure DB schema, then seed the user module (super admin). Safe to run multiple times.
- **npm run db:setup** – Same as `db:ensure` then `db:seed` (one-shot setup).
- **npm run db:guard-schema** – Fails if `prisma/schema.prisma` changed without rollout-plan artifacts (`docs/db-change-plan.md` or db SQL/migration files).

## Adding a new module with its own tables

1. Add your models in `prisma/schema.prisma`.
2. Create migrations: `npx prisma migrate dev --name description` (see `.cursor/rules/prisma-db-sync.mdc`).
3. For destructive refactors, use staged rollout (expand -> backfill -> contract) and update `docs/db-change-plan.md`.
4. If your module has a seed, either:
   - Run it after `runEnsureMigrations()` (see `modules/users/seeds/run-seed.js`), or
   - Document that users run `npm run db:ensure` (or `db:setup`) first, then your seed.

## Safety behavior

- Production applies **committed** migration SQL via `migrate deploy`. Review migration files like code; use backups for risky changes.
