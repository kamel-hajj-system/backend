const express = require('express');
const controller = require('../controllers/locationController');
const { requireAuth, requirePermission, sensitiveLimiter } = require('../../users/middleware');
const {
  handleValidationErrors,
  idParam,
  createLocation,
  updateLocation,
  listQuery,
} = require('../validations/locationValidations');

const router = express.Router();

// Public: list (for registration dropdowns; optional ?isActive=true)
router.get('/locations', listQuery, handleValidationErrors, controller.list);

// Public: get one (for dropdown / display)
router.get('/locations/:id', idParam, handleValidationErrors, controller.getById);

// Protected: create, update (permission-based)
router.post(
  '/locations',
  requireAuth,
  requirePermission('locations.manage'),
  sensitiveLimiter,
  createLocation,
  handleValidationErrors,
  controller.create
);
router.patch(
  '/locations/:id',
  requireAuth,
  requirePermission('locations.manage'),
  sensitiveLimiter,
  updateLocation,
  handleValidationErrors,
  controller.update
);

module.exports = router;
