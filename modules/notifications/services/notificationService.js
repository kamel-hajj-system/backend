const { prisma } = require('../../users/models');
const pushService = require('../../push/services/pushService');

async function resolveTargetUsers({ userIds = [], userType, locationId, sendToAll = false }) {
  const where = {
    isDeleted: false,
    isActive: true,
    isSuperAdmin: false,
  };
  if (userType) where.userType = userType;
  if (locationId) where.locationId = locationId;
  if (Array.isArray(userIds) && userIds.length > 0) where.id = { in: userIds };
  if (!sendToAll && (!Array.isArray(userIds) || userIds.length === 0)) return [];

  const rows = await prisma.user.findMany({
    where,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function sendNotification({ createdById, title, message, userIds, userType, locationId, sendToAll }) {
  const targets = await resolveTargetUsers({ userIds, userType, locationId, sendToAll });
  if (targets.length === 0) return { notificationId: null, sent: 0 };

  const notification = await prisma.notification.create({
    data: {
      title: title?.trim() || null,
      message: message.trim(),
      createdById: createdById || null,
    },
    select: { id: true },
  });

  await prisma.notificationRecipient.createMany({
    data: targets.map((uid) => ({ notificationId: notification.id, userId: uid })),
    skipDuplicates: true,
  });

  const displayTitle = (title && String(title).trim()) || 'Kamel System';
  const bodyText = message.trim();
  void pushService
    .sendPushToUserIds(targets, {
      title: displayTitle,
      body: bodyText.length > 500 ? `${bodyText.slice(0, 497)}…` : bodyText,
      data: { url: '/', notificationId: notification.id },
    })
    .catch(() => {});

  return { notificationId: notification.id, sent: targets.length };
}

async function getMyNotifications(userId, { page = 1, limit = 50 } = {}) {
  const where = { userId };
  const [rows, total, unread] = await Promise.all([
    prisma.notificationRecipient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        isRead: true,
        readAt: true,
        createdAt: true,
        notification: {
          select: { id: true, title: true, message: true, createdAt: true },
        },
      },
    }),
    prisma.notificationRecipient.count({ where }),
    prisma.notificationRecipient.count({ where: { userId, isRead: false } }),
  ]);
  return { data: rows, total, unread, page, limit };
}

async function markAsRead(userId, recipientId) {
  const row = await prisma.notificationRecipient.findFirst({
    where: { id: recipientId, userId },
    select: { id: true, isRead: true },
  });
  if (!row) return null;
  if (row.isRead) return row;
  return prisma.notificationRecipient.update({
    where: { id: recipientId },
    data: { isRead: true, readAt: new Date() },
    select: { id: true, isRead: true, readAt: true },
  });
}

async function getUnreadCount(userId) {
  const unread = await prisma.notificationRecipient.count({
    where: { userId, isRead: false },
  });
  return { unread };
}

module.exports = {
  sendNotification,
  getMyNotifications,
  markAsRead,
  getUnreadCount,
};

