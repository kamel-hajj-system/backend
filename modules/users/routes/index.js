const express = require('express');
const controller = require('../controllers/userController');
const {
  requireAuth,
  requirePermission,
  allowSelfOrPermission,
  optionalAuth,
  loginLimiter,
  sensitiveLimiter,
} = require('../middleware');
const {
  handleValidationErrors,
  createUser,
  updateUser,
  registerEmployee,
  registerServiceCenter,
  userIdParam,
  changePassword,
  assignRole,
  assignPermissions,
  login,
  getUsersQuery,
} = require('../validations/userValidations');

const router = express.Router();

// —— Public (rate-limited) ——
router.post(
  '/users/login',
  loginLimiter,
  login,
  handleValidationErrors,
  controller.login
);

// Optional auth for logout (to log activity if token present)
router.post('/users/logout', optionalAuth, controller.logout);

// —— Public registration (no auth; role assigned by form type) ——
router.post(
  '/users/register/employee',
  loginLimiter,
  sensitiveLimiter,
  registerEmployee,
  handleValidationErrors,
  controller.registerEmployee
);
router.post(
  '/users/register/service-center',
  loginLimiter,
  sensitiveLimiter,
  registerServiceCenter,
  handleValidationErrors,
  controller.registerServiceCenter
);

// —— Current user (for frontend auth state with permissions) ——
router.get('/users/me', requireAuth, controller.getMe);

// —— Protected (permission-based) ——
router.get(
  '/users',
  requireAuth,
  requirePermission('users.view'),
  getUsersQuery,
  handleValidationErrors,
  controller.getUsers
);

router.get(
  '/users/:id',
  requireAuth,
  allowSelfOrPermission('users.view'),
  userIdParam,
  handleValidationErrors,
  controller.getUserById
);

router.post(
  '/users',
  requireAuth,
  requirePermission('users.create'),
  sensitiveLimiter,
  createUser,
  handleValidationErrors,
  controller.createUser
);

router.patch(
  '/users/:id',
  requireAuth,
  requirePermission('users.update'),
  sensitiveLimiter,
  updateUser,
  handleValidationErrors,
  controller.updateUser
);

router.delete(
  '/users/:id',
  requireAuth,
  requirePermission('users.delete'),
  sensitiveLimiter,
  userIdParam,
  handleValidationErrors,
  controller.softDeleteUser
);

router.post(
  '/users/:id/change-password',
  requireAuth,
  sensitiveLimiter,
  changePassword,
  handleValidationErrors,
  controller.changePassword
);

router.post(
  '/users/:id/assign-role',
  requireAuth,
  requirePermission('users.assign_role'),
  sensitiveLimiter,
  assignRole,
  handleValidationErrors,
  controller.assignRole
);

router.post(
  '/users/:id/assign-permissions',
  requireAuth,
  requirePermission('users.assign_permissions'),
  sensitiveLimiter,
  assignPermissions,
  handleValidationErrors,
  controller.assignPermissions
);

module.exports = router;
