const express = require('express');
const { requireAuth, requireSuperAdmin, sensitiveLimiter } = require('../../users/middleware');
const { handleValidationErrors } = require('../../users/validations/userValidations');
const controller = require('../controllers/notificationController');
const validations = require('../validations/notificationValidations');

const router = express.Router();

router.get('/notifications/mine', requireAuth, validations.mineQuery, handleValidationErrors, controller.mine);
router.get('/notifications/unread-count', requireAuth, controller.unreadCount);
router.post('/notifications/:id/read', requireAuth, validations.markRead, handleValidationErrors, controller.markRead);

router.post(
  '/superadmin/notifications/send',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  validations.sendNotification,
  handleValidationErrors,
  controller.send
);

module.exports = router;

