const { DateTime } = require('luxon');
const { prisma } = require('../../users/models');
const notificationService = require('./notificationService');

const TZ = 'Asia/Riyadh';

function parseRecipientIds(json) {
  if (!Array.isArray(json)) return [];
  return [...new Set(json.map((x) => String(x)).filter(Boolean))];
}

async function createScheduled(data) {
  const {
    createdById,
    scope,
    title,
    message,
    recipientIds,
    scheduleKind,
    scheduledAt,
    rangeStartDate,
    rangeEndDate,
    dailyTimeLocal,
  } = data;

  return prisma.scheduledNotification.create({
    data: {
      createdById,
      scope,
      title: title?.trim() || null,
      message: message.trim(),
      recipientIds,
      scheduleKind,
      scheduledAt: scheduledAt || undefined,
      rangeStartDate: rangeStartDate || undefined,
      rangeEndDate: rangeEndDate || undefined,
      dailyTimeLocal: dailyTimeLocal ? String(dailyTimeLocal).trim() : null,
    },
    select: {
      id: true,
      scheduleKind: true,
      scheduledAt: true,
      status: true,
      rangeStartDate: true,
      rangeEndDate: true,
      dailyTimeLocal: true,
    },
  });
}

async function listPendingForUser(userId) {
  return prisma.scheduledNotification.findMany({
    where: { createdById: userId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      scope: true,
      title: true,
      message: true,
      recipientIds: true,
      scheduleKind: true,
      scheduledAt: true,
      rangeStartDate: true,
      rangeEndDate: true,
      dailyTimeLocal: true,
      status: true,
      lastFiredDate: true,
      createdAt: true,
    },
  });
}

async function cancel(userId, id) {
  const row = await prisma.scheduledNotification.findFirst({
    where: { id, createdById: userId, status: 'PENDING' },
  });
  if (!row) return null;
  return prisma.scheduledNotification.update({
    where: { id },
    data: { status: 'CANCELLED' },
    select: { id: true, status: true },
  });
}

async function processTick() {
  const nowUtc = DateTime.utc();

  const onceJobs = await prisma.scheduledNotification.findMany({
    where: {
      status: 'PENDING',
      scheduleKind: 'ONCE',
      scheduledAt: { lte: nowUtc.toJSDate() },
    },
  });

  for (const job of onceJobs) {
    const ids = parseRecipientIds(job.recipientIds);
    if (ids.length === 0) {
      await prisma.scheduledNotification.update({ where: { id: job.id }, data: { status: 'COMPLETED' } });
      continue;
    }
    try {
      await notificationService.sendNotificationToUserIds({
        createdById: job.createdById,
        title: job.title,
        message: job.message,
        userIds: ids,
      });
      await prisma.scheduledNotification.update({ where: { id: job.id }, data: { status: 'COMPLETED' } });
    } catch (e) {
      console.error('[scheduled-notification] ONCE failed', job.id, e.message);
    }
  }

  const nowRiyadh = DateTime.now().setZone(TZ);
  const todayStart = nowRiyadh.startOf('day');
  const todayDateStr = todayStart.toISODate();
  const currentHm = nowRiyadh.toFormat('HH:mm');

  const dailyJobs = await prisma.scheduledNotification.findMany({
    where: {
      status: 'PENDING',
      scheduleKind: 'DAILY_RANGE',
    },
  });

  for (const job of dailyJobs) {
    if (!job.rangeStartDate || !job.rangeEndDate || !job.dailyTimeLocal) continue;

    const start = DateTime.fromJSDate(job.rangeStartDate, { zone: TZ }).startOf('day');
    const end = DateTime.fromJSDate(job.rangeEndDate, { zone: TZ }).endOf('day');

    if (todayStart > end) {
      await prisma.scheduledNotification.update({ where: { id: job.id }, data: { status: 'COMPLETED' } });
      continue;
    }
    if (todayStart < start) continue;

    const want = String(job.dailyTimeLocal).trim();
    if (want !== currentHm) continue;

    if (job.lastFiredDate) {
      const lastStr = DateTime.fromJSDate(job.lastFiredDate, { zone: TZ }).toISODate();
      if (lastStr === todayDateStr) continue;
    }

    const ids = parseRecipientIds(job.recipientIds);
    if (ids.length === 0) continue;

    try {
      await notificationService.sendNotificationToUserIds({
        createdById: job.createdById,
        title: job.title,
        message: job.message,
        userIds: ids,
      });
      await prisma.scheduledNotification.update({
        where: { id: job.id },
        data: { lastFiredDate: todayStart.toJSDate() },
      });
    } catch (e) {
      console.error('[scheduled-notification] DAILY_RANGE failed', job.id, e.message);
    }
  }
}

module.exports = {
  createScheduled,
  listPendingForUser,
  cancel,
  processTick,
  parseRecipientIds,
};
