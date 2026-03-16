const express = require('express');
const controller = require('../controllers/permissionController');
const { requireAuth, requireSuperAdmin, requirePermission, sensitiveLimiter } = require('../../users/middleware');
const {
  handleValidationErrors,
  idParam,
  createPermission,
  updatePermission,
  listQuery,
  getDefaultsQuery,
  setDefaultsBody,
} = require('../validations/permissionValidations');

const router = express.Router();

// —— Protected: list and defaults (before :id) ——
router.get(
  '/permissions',
  requireAuth,
  requirePermission(['permissions.view', 'permissions.manage']),
  listQuery,
  handleValidationErrors,
  controller.list
);

router.get(
  '/permissions/defaults',
  requireAuth,
  requirePermission(['permissions.view', 'permissions.manage']),
  getDefaultsQuery,
  handleValidationErrors,
  controller.getDefaults
);

router.post(
  '/permissions/defaults',
  requireAuth,
  requireSuperAdmin,
  requirePermission('permissions.manage'),
  sensitiveLimiter,
  setDefaultsBody,
  handleValidationErrors,
  controller.setDefaults
);

// —— Single permission (after /defaults) ——
router.get(
  '/permissions/:id',
  requireAuth,
  requirePermission(['permissions.view', 'permissions.manage']),
  idParam,
  handleValidationErrors,
  controller.getById
);

router.post(
  '/permissions',
  requireAuth,
  requireSuperAdmin,
  requirePermission('permissions.manage'),
  sensitiveLimiter,
  createPermission,
  handleValidationErrors,
  controller.create
);

router.patch(
  '/permissions/:id',
  requireAuth,
  requireSuperAdmin,
  requirePermission('permissions.manage'),
  sensitiveLimiter,
  updatePermission,
  handleValidationErrors,
  controller.update
);

router.delete(
  '/permissions/:id',
  requireAuth,
  requireSuperAdmin,
  requirePermission('permissions.manage'),
  sensitiveLimiter,
  idParam,
  handleValidationErrors,
  controller.remove
);

module.exports = router;
