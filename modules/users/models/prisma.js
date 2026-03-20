/**
 * Singleton Prisma client for the users module.
 * Prevents multiple instances in development (hot reload).
 *
 * If you add models and run `npx prisma generate` while the server is running, Node may still
 * hold a stale @prisma/client in require.cache — scheduledNotification (etc.) will be missing.
 * In development we bust the cache and recreate once; if still broken, restart the server.
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

function clientHasScheduledNotifications(client) {
  return client && typeof client.scheduledNotification === 'object' && client.scheduledNotification !== null;
}

let prisma = globalForPrisma.prisma ?? makeClient();

if (!clientHasScheduledNotifications(prisma)) {
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

if (!clientHasScheduledNotifications(prisma)) {
  throw new Error(
    'Prisma client is missing ScheduledNotification. In the backend folder run: npx prisma generate && npx prisma db push (if needed), then restart the Node server so @prisma/client reloads.'
  );
}

module.exports = prisma;
