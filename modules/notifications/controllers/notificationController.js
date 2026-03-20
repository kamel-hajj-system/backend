const { DateTime } = require('luxon');
const notificationService = require('../services/notificationService');
const scheduledNotificationService = require('../services/scheduledNotificationService');

const TZ = 'Asia/Riyadh';

function buildSchedulePayload(body, recipientIds) {
  const { title, message, scheduleKind, scheduledAt, rangeStartDate, rangeEndDate, dailyTimeLocal } = body;

  if (scheduleKind === 'ONCE') {
    if (!scheduledAt) {
      const e = new Error('scheduledAt is required for one-time schedule');
      e.code = 'BAD_SCHEDULE';
      throw e;
    }
    const dt = DateTime.fromISO(String(scheduledAt), { zone: TZ });
    if (!dt.isValid) {
      const e = new Error('Invalid scheduledAt');
      e.code = 'BAD_SCHEDULE';
      throw e;
    }
    if (dt <= DateTime.now().setZone(TZ)) {
      const e = new Error('Schedule time must be in the future');
      e.code = 'BAD_SCHEDULE';
      throw e;
    }
    return {
      title,
      message,
      recipientIds,
      scheduleKind: 'ONCE',
      scheduledAt: dt.toUTC().toJSDate(),
      rangeStartDate: null,
      rangeEndDate: null,
      dailyTimeLocal: null,
    };
  }

  if (scheduleKind === 'DAILY_RANGE') {
    if (!rangeStartDate || !rangeEndDate || !dailyTimeLocal) {
      const e = new Error('rangeStartDate, rangeEndDate, and dailyTimeLocal are required for daily range');
      e.code = 'BAD_SCHEDULE';
      throw e;
    }
    const start = DateTime.fromISO(String(rangeStartDate).slice(0, 10), { zone: TZ }).startOf('day');
    const end = DateTime.fromISO(String(rangeEndDate).slice(0, 10), { zone: TZ }).startOf('day');
    if (!start.isValid || !end.isValid || end < start) {
      const e = new Error('Invalid date range');
      e.code = 'BAD_SCHEDULE';
      throw e;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(dailyTimeLocal).trim())) {
      const e = new Error('dailyTimeLocal must be HH:mm (24h)');
      e.code = 'BAD_SCHEDULE';
      throw e;
    }
    return {
      title,
      message,
      recipientIds,
      scheduleKind: 'DAILY_RANGE',
      scheduledAt: null,
      rangeStartDate: start.toJSDate(),
      rangeEndDate: end.toJSDate(),
      dailyTimeLocal: String(dailyTimeLocal).trim(),
    };
  }

  const e = new Error('Invalid scheduleKind');
  e.code = 'BAD_SCHEDULE';
  throw e;
}

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

async function supervisorSend(req, res, next) {
  try {
    const ids = await notificationService.validateSupervisorRecipients(req.user.id, req.body.userIds);
    const result = await notificationService.sendNotificationToUserIds({
      createdById: req.user.id,
      title: req.body.title,
      message: req.body.message,
      userIds: ids,
    });
    return res.json(result);
  } catch (err) {
    if (err.code === 'INVALID_RECIPIENTS') {
      return res.status(403).json({ error: 'You can only notify your direct employees.' });
    }
    next(err);
  }
}

async function supervisorSchedule(req, res, next) {
  try {
    const ids = await notificationService.validateSupervisorRecipients(req.user.id, req.body.userIds);
    const payload = buildSchedulePayload(req.body, ids);
    const row = await scheduledNotificationService.createScheduled({
      createdById: req.user.id,
      scope: 'supervisor',
      ...payload,
    });
    return res.status(201).json(row);
  } catch (err) {
    if (err.code === 'BAD_SCHEDULE') return res.status(400).json({ error: err.message });
    if (err.code === 'INVALID_RECIPIENTS') {
      return res.status(403).json({ error: 'You can only schedule for your direct employees.' });
    }
    next(err);
  }
}

async function hrSend(req, res, next) {
  try {
    const ids = await notificationService.validateHrRecipients(req.body.userIds);
    const result = await notificationService.sendNotificationToUserIds({
      createdById: req.user.id,
      title: req.body.title,
      message: req.body.message,
      userIds: ids,
    });
    return res.json(result);
  } catch (err) {
    if (err.code === 'INVALID_RECIPIENTS') {
      return res.status(400).json({ error: 'Invalid user selection.' });
    }
    next(err);
  }
}

async function hrSchedule(req, res, next) {
  try {
    const ids = await notificationService.validateHrRecipients(req.body.userIds);
    const payload = buildSchedulePayload(req.body, ids);
    const row = await scheduledNotificationService.createScheduled({
      createdById: req.user.id,
      scope: 'hr',
      ...payload,
    });
    return res.status(201).json(row);
  } catch (err) {
    if (err.code === 'BAD_SCHEDULE') return res.status(400).json({ error: err.message });
    if (err.code === 'INVALID_RECIPIENTS') return res.status(400).json({ error: 'Invalid user selection.' });
    next(err);
  }
}

async function superadminSchedule(req, res, next) {
  try {
    const ids = await notificationService.validateSuperAdminStyleRecipients(req.body.userIds);
    const payload = buildSchedulePayload(req.body, ids);
    const row = await scheduledNotificationService.createScheduled({
      createdById: req.user.id,
      scope: 'superadmin',
      ...payload,
    });
    return res.status(201).json(row);
  } catch (err) {
    if (err.code === 'BAD_SCHEDULE') return res.status(400).json({ error: err.message });
    if (err.code === 'INVALID_RECIPIENTS') return res.status(400).json({ error: 'Invalid user selection.' });
    next(err);
  }
}

async function listMyScheduled(req, res, next) {
  try {
    const rows = await scheduledNotificationService.listPendingForUser(req.user.id);
    return res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

async function cancelScheduled(req, res, next) {
  try {
    const row = await scheduledNotificationService.cancel(req.user.id, req.params.id);
    if (!row) return res.status(404).json({ error: 'Scheduled notification not found' });
    return res.json(row);
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
  supervisorSend,
  supervisorSchedule,
  hrSend,
  hrSchedule,
  superadminSchedule,
  listMyScheduled,
  cancelScheduled,
  mine,
  unreadCount,
  markRead,
};
