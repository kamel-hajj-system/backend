const express = require('express');
const {
  requireAuth,
  requireSuperAdmin,
  requireHrCanEdit,
  requireCompanySupervisor,
  sensitiveLimiter,
} = require('../../users/middleware');
const { handleValidationErrors } = require('../../users/validations/userValidations');
const controller = require('../controllers/notificationController');
const validations = require('../validations/notificationValidations');

const router = express.Router();

router.get('/notifications/mine', requireAuth, validations.mineQuery, handleValidationErrors, controller.mine);
router.get('/notifications/unread-count', requireAuth, controller.unreadCount);
router.get('/notifications/scheduled', requireAuth, controller.listMyScheduled);
router.delete(
  '/notifications/scheduled/:id',
  requireAuth,
  validations.cancelScheduled,
  handleValidationErrors,
  controller.cancelScheduled
);
router.post('/notifications/:id/read', requireAuth, validations.markRead, handleValidationErrors, controller.markRead);

// Company supervisor: notify direct reports only
router.post(
  '/portal/company/supervisor/notifications/send',
  requireAuth,
  requireCompanySupervisor,
  sensitiveLimiter,
  validations.sendToSelectedUsers,
  handleValidationErrors,
  controller.supervisorSend
);
router.post(
  '/portal/company/supervisor/notifications/schedule',
  requireAuth,
  requireCompanySupervisor,
  sensitiveLimiter,
  validations.scheduleNotification,
  handleValidationErrors,
  controller.supervisorSchedule
);

// HR (Supervisor / EmpManage with HR access): notify selected org users
router.post(
  '/hr/notifications/send',
  requireAuth,
  requireHrCanEdit,
  sensitiveLimiter,
  validations.sendToSelectedUsers,
  handleValidationErrors,
  controller.hrSend
);
router.post(
  '/hr/notifications/schedule',
  requireAuth,
  requireHrCanEdit,
  sensitiveLimiter,
  validations.scheduleNotification,
  handleValidationErrors,
  controller.hrSchedule
);

router.post(
  '/superadmin/notifications/send',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  validations.sendNotification,
  handleValidationErrors,
  controller.send
);
router.post(
  '/superadmin/notifications/schedule',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  validations.scheduleNotification,
  handleValidationErrors,
  controller.superadminSchedule
);

module.exports = router;

