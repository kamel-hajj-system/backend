/**
 * Align the database with prisma/schema.prisma (db push). Used before seeding.
 * Run: npm run db:ensure
 */
const path = require('path');
const { execSync } = require('child_process');

const backendRoot = path.resolve(__dirname, '..');

function ensureDatabaseUrl() {
  const { ensureDatabaseUrl: load } = require('./lib/db-env.js');
  return load(path.resolve(backendRoot, '.env'));
}

async function runEnsureMigrations() {
  ensureDatabaseUrl();
  const acceptDataLoss = process.env.PRISMA_DB_PUSH_ACCEPT_DATA_LOSS === 'true';
  execSync(`npx prisma db push${acceptDataLoss ? ' --accept-data-loss' : ''}`, {
    stdio: 'inherit',
    cwd: backendRoot,
    env: process.env,
  });
  console.log('Prisma db push OK.');
}

module.exports = { runEnsureMigrations, ensureDatabaseUrl };

if (require.main === module) {
  runEnsureMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
