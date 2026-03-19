const notificationService = require('../services/notificationService');

async function send(req, res, next) {
  try {
    const { title, message, userIds, userType, locationId, sendToAll } = req.body || {};
    const result = await notificationService.sendNotification({
      createdById: req.user?.id,
      title,
      message,
      userIds: userIds || [],
      userType,
      locationId,
      sendToAll: sendToAll === true,
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function mine(req, res, next) {
  try {
    const { page, limit } = req.query || {};
    const result = await notificationService.getMyNotifications(req.user.id, { page, limit });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function unreadCount(req, res, next) {
  try {
    const result = await notificationService.getUnreadCount(req.user.id);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const row = await notificationService.markAsRead(req.user.id, req.params.id);
    if (!row) return res.status(404).json({ error: 'Notification not found' });
    return res.json(row);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  send,
  mine,
  unreadCount,
  markRead,
};

