/**
 * Shared database env setup for scripts (seed, migrate, future modules).
 * Call once at script start so Prisma and any pg code see DATABASE_URL.
 * No change to existing env if DATABASE_URL is already set.
 */
const path = require('path');

function ensureDatabaseUrl(envPath = null) {
  const dotenv = require('dotenv');
  const target = envPath || path.resolve(process.cwd(), '.env');
  dotenv.config({ path: target });

  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, DB_SSL } = process.env;
  if (!PGHOST) {
    throw new Error(
      'DATABASE_URL or PGHOST (and PGUSER, PGPASSWORD, PGDATABASE) must be set. See .env.example.'
    );
  }

  const user = PGUSER || '';
  const pass = PGPASSWORD ? `:${encodeURIComponent(PGPASSWORD)}` : '';
  const host = PGHOST;
  const port = PGPORT || '5432';
  const db = PGDATABASE || 'postgres';
  const ssl = DB_SSL === 'true' ? '?sslmode=require' : '';
  const url = `postgresql://${user}${pass}@${host}:${port}/${db}${ssl}`;
  process.env.DATABASE_URL = url;
  return url;
}

module.exports = { ensureDatabaseUrl };
