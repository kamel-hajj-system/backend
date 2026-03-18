const express = require('express');
const controller = require('../controllers/locationController');
const { requireAuth, requireSuperAdmin, sensitiveLimiter } = require('../../users/middleware');
const {
  handleValidationErrors,
  idParam,
  createLocation,
  updateLocation,
  listQuery,
} = require('../validations/locationValidations');

const router = express.Router();

router.get('/locations', listQuery, handleValidationErrors, controller.list);
router.get('/locations/:id', idParam, handleValidationErrors, controller.getById);

router.post(
  '/locations',
  requireAuth, requireSuperAdmin, sensitiveLimiter,
  createLocation, handleValidationErrors,
  controller.create
);
router.patch(
  '/locations/:id',
  requireAuth, requireSuperAdmin, sensitiveLimiter,
  updateLocation, handleValidationErrors,
  controller.update
);

module.exports = router;
