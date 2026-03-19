const express = require('express');
const { requireAuth, sensitiveLimiter } = require('../../users/middleware');
const { handleValidationErrors } = require('../../users/validations/userValidations');
const controller = require('../controllers/pushController');
const validations = require('../validations/pushValidations');

const router = express.Router();

router.get('/push/vapid-public-key', controller.vapidPublicKey);

router.post(
  '/push/subscribe',
  requireAuth,
  sensitiveLimiter,
  validations.subscribe,
  handleValidationErrors,
  controller.subscribe
);

router.post(
  '/push/unsubscribe',
  requireAuth,
  sensitiveLimiter,
  validations.unsubscribe,
  handleValidationErrors,
  controller.unsubscribe
);

module.exports = router;
