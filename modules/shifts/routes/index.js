const express = require('express');
const controller = require('../controllers/shiftController');
const { requireAuth, requirePermission, sensitiveLimiter } = require('../../users/middleware');
const {
  handleValidationErrors,
  idParam,
  createShift,
  updateShift,
  listQuery,
} = require('../validations/shiftValidations');

const router = express.Router();

// Public: list (for registration dropdowns; optional ?isForEmployee=true)
router.get('/shifts', listQuery, handleValidationErrors, controller.list);

// Public: get one
router.get('/shifts/:id', idParam, handleValidationErrors, controller.getById);

// Protected: create, update (permission-based)
router.post(
  '/shifts',
  requireAuth,
  requirePermission('shifts.manage'),
  sensitiveLimiter,
  createShift,
  handleValidationErrors,
  controller.create
);
router.patch(
  '/shifts/:id',
  requireAuth,
  requirePermission('shifts.manage'),
  sensitiveLimiter,
  updateShift,
  handleValidationErrors,
  controller.update
);

module.exports = router;
