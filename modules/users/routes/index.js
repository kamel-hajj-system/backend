const express = require('express');
const controller = require('../controllers/userController');
const {
  requireAuth,
  requireSuperAdmin,
  requireHr,
  requireHrCanEdit,
  requireCompanySupervisor,
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
  resetPassword,
  login,
  getUsersQuery,
  setAccessGrants,
  bulkAssignSupervisor,
  getSupervisorsTreeQuery,
  getMyEmployeesQuery,
} = require('../validations/userValidations');

const router = express.Router();

router.post('/users/login', loginLimiter, login, handleValidationErrors, controller.login);
router.post('/users/logout', optionalAuth, controller.logout);
router.post('/users/refresh', controller.refresh);

router.post(
  '/users/register/employee',
  loginLimiter, sensitiveLimiter,
  registerEmployee, handleValidationErrors,
  controller.registerEmployee
);
router.post(
  '/users/register/service-center',
  loginLimiter, sensitiveLimiter,
  registerServiceCenter, handleValidationErrors,
  controller.registerServiceCenter
);

router.get('/users/me', requireAuth, controller.getMe);

router.get('/users', requireAuth, requireSuperAdmin, getUsersQuery, handleValidationErrors, controller.getUsers);

// Supervisors tree (Super Admin) - MUST be before /users/:id
router.get(
  '/users/supervisors-tree',
  requireAuth,
  requireSuperAdmin,
  getSupervisorsTreeQuery,
  handleValidationErrors,
  controller.getSupervisorsTree
);

router.get('/users/:id', requireAuth, requireSuperAdmin, userIdParam, handleValidationErrors, controller.getUserById);
router.post('/users', requireAuth, requireSuperAdmin, sensitiveLimiter, createUser, handleValidationErrors, controller.createUser);
router.patch('/users/:id', requireAuth, requireSuperAdmin, sensitiveLimiter, updateUser, handleValidationErrors, controller.updateUser);
router.delete('/users/:id', requireAuth, requireSuperAdmin, sensitiveLimiter, userIdParam, handleValidationErrors, controller.softDeleteUser);
router.post('/users/:id/change-password', requireAuth, sensitiveLimiter, changePassword, handleValidationErrors, controller.changePassword);

// Super Admin: bulk assign supervisor/role for Company users
router.post(
  '/users/bulk/assign-supervisor',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  bulkAssignSupervisor,
  handleValidationErrors,
  controller.bulkAssignSupervisor
);

// Super Admin: access grants (modules/pages)
router.get('/access/grants', requireAuth, requireSuperAdmin, controller.getAccessGrants);
router.post(
  '/access/grants',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  setAccessGrants,
  handleValidationErrors,
  controller.setAccessGrants
);

// HR views / editing (any HR user can view; only Supervisor/EmpManage can edit)
router.get(
  '/hr/users',
  requireAuth,
  requireHr,
  getUsersQuery,
  handleValidationErrors,
  controller.getUsers
);

// Supervisors tree (HR)
router.get(
  '/hr/supervisors-tree',
  requireAuth,
  requireHr,
  getSupervisorsTreeQuery,
  handleValidationErrors,
  controller.getSupervisorsTree
);
router.patch(
  '/hr/users/:id',
  requireAuth,
  requireHrCanEdit,
  sensitiveLimiter,
  updateUser,
  handleValidationErrors,
  controller.updateUser
);

router.post(
  '/hr/users/:id/reset-password',
  requireAuth,
  requireHrCanEdit,
  sensitiveLimiter,
  resetPassword,
  handleValidationErrors,
  controller.hrResetPassword
);

// Company portal: supervisor can see his employees
router.get(
  '/portal/company/my-employees',
  requireAuth,
  requireCompanySupervisor,
  getMyEmployeesQuery,
  handleValidationErrors,
  controller.getMyEmployees
);

module.exports = router;
