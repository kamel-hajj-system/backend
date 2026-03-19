const { body } = require('express-validator');

const subscribe = [
  body('endpoint').isString().notEmpty().isLength({ max: 2048 }),
  body('keys').isObject(),
  body('keys.p256dh').isString().notEmpty(),
  body('keys.auth').isString().notEmpty(),
];

const unsubscribe = [body('endpoint').isString().notEmpty().isLength({ max: 2048 })];

module.exports = {
  subscribe,
  unsubscribe,
};
