const { body, query, param } = require('express-validator');

const sendNotification = [
  body('title').optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
  body('message').isString().trim().isLength({ min: 1, max: 5000 }),
  body('sendToAll').optional().isBoolean(),
  body('userType').optional().isIn(['Company', 'ServiceCenter']),
  body('locationId').optional({ nullable: true, checkFalsy: true }).isUUID(),
  body('shiftId').optional({ nullable: true, checkFalsy: true }).isUUID(),
  body('userIds').optional().isArray(),
  body('userIds.*').optional().isUUID(),
];

const mineQuery = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
];

const markRead = [param('id').isUUID()];

const sendToSelectedUsers = [
  body('title').optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
  body('message').isString().trim().isLength({ min: 1, max: 5000 }),
  body('userIds').isArray({ min: 1 }),
  body('userIds.*').isUUID(),
];

const scheduleNotification = [
  body('title').optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
  body('message').isString().trim().isLength({ min: 1, max: 5000 }),
  body('userIds').isArray({ min: 1 }),
  body('userIds.*').isUUID(),
  body('scheduleKind').isIn(['ONCE', 'DAILY_RANGE']),
  body('scheduledAt').optional({ nullable: true }).isString(),
  body('rangeStartDate').optional({ nullable: true }).isString(),
  body('rangeEndDate').optional({ nullable: true }).isString(),
  body('dailyTimeLocal').optional({ nullable: true }).isString(),
];

const cancelScheduled = [param('id').isUUID()];

module.exports = {
  sendNotification,
  sendToSelectedUsers,
  scheduleNotification,
  cancelScheduled,
  mineQuery,
  markRead,
};

