const { DateTime } = require('luxon');
const { prisma } = require('../models');

const SAUDI_ZONE = 'Asia/Riyadh';

/** Token refresh spam should not dominate “activity”. */
const EXCLUDE_FROM_MEANINGFUL = new Set(['auth.refresh']);

function getClientIp(req) {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string' && xfwd.trim() !== '') return xfwd.split(',')[0].trim();
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim() !== '') return realIp.trim();
  return req.ip;
}

async function logAudit({ req, userId, action, entity, entityId, meta }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entity: entity || null,
        entityId: entityId ? String(entityId) : null,
        ip: req ? getClientIp(req) : null,
        meta: meta ?? undefined,
      },
    });
  } catch {
    // Never block request on audit failure.
  }
}

/**
 * Per-day audit counts for the signed-in user (for portal dashboard charts).
 * `meaningfulCount` excludes high-frequency refresh events.
 */
async function getMyActivitySummary(userId, days = 14) {
  const d = Math.min(Math.max(Number(days) || 14, 7), 30);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, isDeleted: true },
  });

  const end = DateTime.now().setZone(SAUDI_ZONE).startOf('day');
  const start = end.minus({ days: d - 1 });

  const logs = await prisma.auditLog.findMany({
    where: {
      userId,
      createdAt: { gte: start.toJSDate() },
    },
    select: { action: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const byDay = new Map();
  for (const log of logs) {
    const key = DateTime.fromJSDate(log.createdAt).setZone(SAUDI_ZONE).toFormat('yyyy-MM-dd');
    if (!byDay.has(key)) {
      byDay.set(key, { meaningful: 0, logins: 0 });
    }
    const bucket = byDay.get(key);
    if (log.action === 'auth.login') bucket.logins += 1;
    if (!EXCLUDE_FROM_MEANINGFUL.has(log.action)) bucket.meaningful += 1;
  }

  const labels = [];
  const meaningful = [];
  const logins = [];
  let totalMeaningful = 0;
  let activeDays = 0;

  for (let i = 0; i < d; i += 1) {
    const day = start.plus({ days: i });
    const key = day.toFormat('yyyy-MM-dd');
    labels.push(day.toFormat('MM/dd'));
    const b = byDay.get(key) || { meaningful: 0, logins: 0 };
    meaningful.push(b.meaningful);
    logins.push(b.logins);
    totalMeaningful += b.meaningful;
    if (b.meaningful > 0) activeDays += 1;
  }

  const quietDays = user?.isActive && !user?.isDeleted ? Math.max(0, d - activeDays) : 0;

  return {
    days: d,
    zone: SAUDI_ZONE,
    accountActive: Boolean(user?.isActive && !user?.isDeleted),
    labels,
    meaningful,
    logins,
    totals: {
      totalMeaningful,
      activeDays,
      quietDays,
    },
  };
}

module.exports = {
  logAudit,
  getMyActivitySummary,
};

