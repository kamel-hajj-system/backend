const express = require('express');
const controller = require('../controllers/userController');
const {
  requireAuth,
  requireSuperAdmin,
  requireHr,
  requireHrCanEdit,
  requireCompanySupervisor,
  requireCompanySupervisorOrAccessCodes,
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
  approvePendingUser,
  approveSupervisorPendingUser,
  patchMyEmployeeRole,
  getSignupSupervisorsQuery,
  setDelegatedVisibility,
  activitySummaryDaysQuery,
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

/** Public: supervisors at a work location (employee sign-up dropdown). */
router.get(
  '/users/register/supervisors',
  loginLimiter,
  getSignupSupervisorsQuery,
  handleValidationErrors,
  controller.listSupervisorsForSignup
);

router.get('/users/me', requireAuth, controller.getMe);

router.get(
  '/users/me/activity-summary',
  requireAuth,
  activitySummaryDaysQuery,
  handleValidationErrors,
  controller.getMyActivitySummary
);

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

// Super Admin: explicit viewer → visible company users (data only; portal enforcement later)
router.get(
  '/delegated-employee-visibility',
  requireAuth,
  requireSuperAdmin,
  controller.listDelegatedVisibility
);
router.put(
  '/delegated-employee-visibility/:viewerId',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  setDelegatedVisibility,
  handleValidationErrors,
  controller.setDelegatedVisibility
);

// HR views / editing (any HR user can view; only Supervisor/EmpManage can edit)
router.get(
  '/hr/pending-registrations/summary',
  requireAuth,
  requireHr,
  controller.getPendingRegistrationsSummary
);
router.get(
  '/hr/pending-registrations',
  requireAuth,
  requireHr,
  controller.listPendingRegistrations
);
router.post(
  '/hr/users/:id/approve',
  requireAuth,
  requireHrCanEdit,
  sensitiveLimiter,
  approvePendingUser,
  handleValidationErrors,
  controller.approvePendingUser
);

router.get(
  '/hr/users',
  requireAuth,
  requireHr,
  getUsersQuery,
  handleValidationErrors,
  controller.getUsers
);

router.get('/hr/dashboard-stats', requireAuth, requireHr, controller.getHrDashboardStats);

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

// Company portal: supervisor or delegated team viewer can list team employees (for filters / UI)
router.get(
  '/portal/company/my-employees',
  requireAuth,
  requireCompanySupervisorOrAccessCodes('portal.company.employees'),
  getMyEmployeesQuery,
  handleValidationErrors,
  controller.getMyEmployees
);
router.patch(
  '/portal/company/my-employees/:id',
  requireAuth,
  requireCompanySupervisor,
  sensitiveLimiter,
  patchMyEmployeeRole,
  handleValidationErrors,
  controller.patchMyEmployeeRole
);

router.get(
  '/portal/company/supervisor/pending-registrations/summary',
  requireAuth,
  requireCompanySupervisor,
  controller.getSupervisorPendingRegistrationsSummary
);
router.get(
  '/portal/company/supervisor/pending-registrations',
  requireAuth,
  requireCompanySupervisor,
  controller.listSupervisorPendingRegistrations
);
router.post(
  '/portal/company/supervisor/users/:id/approve',
  requireAuth,
  requireCompanySupervisor,
  sensitiveLimiter,
  approveSupervisorPendingUser,
  handleValidationErrors,
  controller.approveSupervisorPendingUser
);

module.exports = router;
