/**
 * Ensure Prisma migrations are applied and user module tables exist.
 * Self-heals when migration was marked applied but tables are missing (e.g. different DB).
 * Run from backend dir: node scripts/ensure-migrations.js
 * Or require and call runEnsureMigrations() from seed/other scripts.
 */
const path = require('path');
const { execSync } = require('child_process');

const backendRoot = path.resolve(__dirname, '..');
const USER_MODULE_MIGRATION = '20240314000000_user_module';

function ensureDatabaseUrl() {
  const { ensureDatabaseUrl: load } = require('./lib/db-env.js');
  return load(path.resolve(backendRoot, '.env'));
}

function runMigrateDeploy() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    cwd: backendRoot,
    env: process.env,
  });
}

/**
 * Remove migration record from _prisma_migrations so Prisma will re-run it on next deploy.
 * Use when migration is "applied" but tables are missing (e.g. different DB or partial run).
 */
async function unrecordMigration(migrationName) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      'DELETE FROM _prisma_migrations WHERE migration_name = $1',
      migrationName
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Returns true if users table exists and is usable.
 */
async function usersTableExists() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRawUnsafe('SELECT 1 FROM users LIMIT 0');
    return true;
  } catch (e) {
    if (e.code === 'P2021' || (e.message && e.message.includes('does not exist'))) {
      return false;
    }
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Ensure migrations applied and user module schema exists. Self-heals if migration
 * was marked applied but tables missing.
 */
async function runEnsureMigrations() {
  ensureDatabaseUrl();
  runMigrateDeploy();

  const exists = await usersTableExists();
  if (exists) return;

  console.log('User module tables missing despite migration record. Re-applying migration...');
  await unrecordMigration(USER_MODULE_MIGRATION);
  runMigrateDeploy();

  const existsNow = await usersTableExists();
  if (!existsNow) {
    throw new Error('User module tables still missing after re-apply. Check database and migrations.');
  }
  console.log('User module schema applied successfully.');
}

module.exports = { runEnsureMigrations, ensureDatabaseUrl, usersTableExists };
