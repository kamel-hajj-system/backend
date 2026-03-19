const { body, query, param } = require('express-validator');

const sendNotification = [
  body('title').optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
  body('message').isString().trim().isLength({ min: 1, max: 5000 }),
  body('sendToAll').optional().isBoolean(),
  body('userType').optional().isIn(['Company', 'ServiceCenter']),
  body('locationId').optional({ nullable: true, checkFalsy: true }).isUUID(),
  body('userIds').optional().isArray(),
  body('userIds.*').optional().isUUID(),
];

const mineQuery = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
];

const markRead = [param('id').isUUID()];

module.exports = {
  sendNotification,
  mineQuery,
  markRead,
};

