/**
 * Apply pending Prisma migrations (ordered). Used before seeding.
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
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    cwd: backendRoot,
    env: process.env,
  });
  console.log('Prisma migrate deploy OK.');
}

module.exports = { runEnsureMigrations, ensureDatabaseUrl };

if (require.main === module) {
  runEnsureMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
