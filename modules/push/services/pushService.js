const webpush = require('web-push');
const { prisma } = require('../../users/models');

let vapidInitialized = false;

function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function getPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function initVapid() {
  if (vapidInitialized) return true;
  if (!isPushConfigured()) return false;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@kamel-system.com';
  webpush.setVapidDetails(subject, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  vapidInitialized = true;
  return true;
}

/**
 * Save or update subscription for current user (same browser endpoint = upsert).
 */
async function saveSubscription(userId, { endpoint, keys, userAgent }) {
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('INVALID_SUBSCRIPTION');
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || null,
    },
    update: {
      userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || null,
    },
  });
}

async function removeSubscription(userId, endpoint) {
  if (!endpoint) return;
  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
}

/**
 * Remove all push subscriptions for a user (e.g. logout optional – not wired by default).
 */
async function removeAllForUser(userId) {
  await prisma.pushSubscription.deleteMany({ where: { userId } });
}

/**
 * Send Web Push to all stored subscriptions for the given user IDs.
 * Failures are logged; invalid endpoints (410/404) are deleted. Never throws.
 */
async function sendPushToUserIds(userIds, payload) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  if (!initVapid()) return;

  const title = typeof payload.title === 'string' ? payload.title : 'Kamel';
  const body = typeof payload.body === 'string' ? payload.body : '';
  const data = payload.data && typeof payload.data === 'object' ? payload.data : { url: '/' };

  const bodyString = JSON.stringify({
    title,
    body,
    message: body,
    data,
  });

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  await Promise.all(
    subs.map(async (s) => {
      const pushSub = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        await webpush.sendNotification(pushSub, bodyString, {
          TTL: 3600,
          urgency: 'normal',
        });
      } catch (err) {
        const code = err.statusCode;
        if (code === 410 || code === 404) {
          try {
            await prisma.pushSubscription.delete({ where: { endpoint: s.endpoint } });
          } catch {
            // ignore
          }
        }
      }
    })
  );
}

module.exports = {
  isPushConfigured,
  getPublicKey,
  initVapid,
  saveSubscription,
  removeSubscription,
  removeAllForUser,
  sendPushToUserIds,
};
