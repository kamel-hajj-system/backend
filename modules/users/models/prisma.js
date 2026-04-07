/**
 * Singleton Prisma client for the users module.
 * Prevents multiple instances in development (hot reload).
 *
 * If you change schema.prisma, run `npx prisma generate` (or `npm install` / `npm run dev` — see package.json)
 * and restart the server. Otherwise you may see DB errors like "column pilgrims_count does not exist"
 * when the DB was updated but Node still loaded an old @prisma/client.
 * If you add models and run generate while the server is running, Node may still hold a stale client —
 * scheduledNotification (etc.) will be missing. In development we bust the cache and recreate once.
 */
const globalForPrisma = global;

function reloadPrismaModulesFromDisk() {
  if (process.env.NODE_ENV === 'production') return;
  for (const key of Object.keys(require.cache)) {
    if (key.includes('node_modules/@prisma/client') || key.includes('node_modules/.prisma/client')) {
      delete require.cache[key];
    }
  }
}

function makeClient() {
  const { PrismaClient } = require('@prisma/client');
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

/** Stale singletons miss new models after schema changes until generate + restart. */
function clientHasExpectedDelegates(client) {
  return (
    client &&
    typeof client.scheduledNotification === 'object' &&
    client.scheduledNotification !== null &&
    typeof client.nusukSheetRow === 'object' &&
    client.nusukSheetRow !== null &&
    typeof client.nusukSettings === 'object' &&
    client.nusukSettings !== null &&
    typeof client.nusukSyncSnapshot === 'object' &&
    client.nusukSyncSnapshot !== null &&
    typeof client.serviceCenterPreArrivalSettings === 'object' &&
    client.serviceCenterPreArrivalSettings !== null
  );
}

let prisma = globalForPrisma.prisma ?? makeClient();

if (!clientHasExpectedDelegates(prisma)) {
  if (globalForPrisma.prisma) {
    globalForPrisma.prisma.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
  reloadPrismaModulesFromDisk();
  prisma = makeClient();
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

if (!clientHasExpectedDelegates(prisma)) {
  throw new Error(
    'Prisma client is out of date (missing models). In the backend folder run: npx prisma generate && npx prisma migrate deploy (or db push), then restart the Node server.'
  );
}

module.exports = prisma;
