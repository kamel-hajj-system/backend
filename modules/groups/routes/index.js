const express = require('express');
const controller = require('../controllers/groupController');
const { requireAuth, requireSuperAdmin, sensitiveLimiter } = require('../../users/middleware');
const {
  handleValidationErrors,
  idParam,
  createGroup,
  updateGroup,
  listQuery,
  setPermissionsBody,
  setUsersBody,
} = require('../validations/groupValidations');

const router = express.Router();

router.get(
  '/groups',
  requireAuth,
  requireSuperAdmin,
  listQuery,
  handleValidationErrors,
  controller.list
);

router.get(
  '/groups/:id',
  requireAuth,
  requireSuperAdmin,
  idParam,
  handleValidationErrors,
  controller.getById
);

router.post(
  '/groups',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  createGroup,
  handleValidationErrors,
  controller.create
);

router.patch(
  '/groups/:id',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  idParam,
  updateGroup,
  handleValidationErrors,
  controller.update
);

router.delete(
  '/groups/:id',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  idParam,
  handleValidationErrors,
  controller.remove
);

router.post(
  '/groups/:id/permissions',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  idParam,
  setPermissionsBody,
  handleValidationErrors,
  controller.setPermissions
);

router.post(
  '/groups/:id/users',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  idParam,
  setUsersBody,
  handleValidationErrors,
  controller.setUsers
);

module.exports = router;
