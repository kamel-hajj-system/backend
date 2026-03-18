const express = require('express');
const controller = require('../controllers/shiftController');
const { requireAuth, requireSuperAdmin, sensitiveLimiter } = require('../../users/middleware');
const {
  handleValidationErrors,
  idParam,
  createShift,
  updateShift,
  listQuery,
} = require('../validations/shiftValidations');

const router = express.Router();

router.get('/shifts', listQuery, handleValidationErrors, controller.list);
router.get('/shifts/:id', idParam, handleValidationErrors, controller.getById);

router.post(
  '/shifts',
  requireAuth, requireSuperAdmin, sensitiveLimiter,
  createShift, handleValidationErrors,
  controller.create
);
router.patch(
  '/shifts/:id',
  requireAuth, requireSuperAdmin, sensitiveLimiter,
  updateShift, handleValidationErrors,
  controller.update
);

module.exports = router;
