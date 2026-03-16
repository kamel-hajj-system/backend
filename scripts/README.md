# Database scripts

Shared scripts for database setup and migrations. Use these so all modules (users now, others later) behave the same.

## Env

- **scripts/lib/db-env.js** – `ensureDatabaseUrl(envPath?)`. Loads `.env` and sets `DATABASE_URL` from `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`/`PGPORT`/`DB_SSL` if `DATABASE_URL` is not set. Use at the start of any script that uses Prisma or DB.

## Commands (from backend root)

- **npm run db:ensure** – Apply Prisma migrations and self-heal if the user module migration was marked applied but tables are missing (re-applies that migration).
- **npm run db:seed** – Ensure migrations (with self-heal), then seed the user module (super admin). Safe to run multiple times.
- **npm run db:setup** – Same as `db:ensure` then `db:seed` (one-shot setup).

## Adding a new module with its own tables

1. Add your models in `prisma/schema.prisma`.
2. Create a new migration: `npx prisma migrate dev --name your_module_name`.
3. Keep migrations **idempotent** where possible (e.g. `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, enum creation in `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`) so re-applying is safe.
4. If your module has a seed, either:
   - Run it after `runEnsureMigrations()` (see `modules/users/seeds/run-seed.js`), or
   - Document that users run `npm run db:ensure` (or `db:setup`) first, then your seed.

## Self-heal behavior

If Prisma says “No pending migrations” but the `users` table (or other expected tables) are missing, `db:ensure` and `db:seed` will:

1. Remove that migration’s row from `_prisma_migrations` so Prisma treats it as pending again.
2. Run `prisma migrate deploy` again so that migration runs and creates the tables.

The user module migration is written to be idempotent so this re-apply does not fail if some objects already exist.
