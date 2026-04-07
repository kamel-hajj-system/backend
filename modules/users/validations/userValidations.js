const { body, param, query, validationResult } = require('express-validator');
const { UserType, Role } = require('../models/constants');

/**
 * Validation result handler middleware.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((e) => ({ path: e.path, msg: e.msg })),
    });
  }
  next();
}

const userTypeValues = Object.values(UserType);
const roleValues = Object.values(Role);
/** Roles a company supervisor may assign (not Supervisor). */
const supervisorAssignableRoles = ['EmpRead', 'EmpManage'];

const createUser = [
  body('fullName').trim().notEmpty().withMessage('fullName is required'),
  body('fullNameAr').optional().trim(),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('phone').optional().trim(),
  body('userType')
    .isIn(userTypeValues)
    .withMessage(`userType must be one of: ${userTypeValues.join(', ')}`),
  body('role')
    .optional()
    .isIn(roleValues)
    .withMessage(`role must be one of: ${roleValues.join(', ')}`),
  body('jobTitle').optional().trim(),
  body('shiftId').optional({ checkFalsy: true }).isUUID().withMessage('shiftId must be a valid UUID'),
  body('locationId').optional({ checkFalsy: true }).isUUID().withMessage('locationId must be a valid UUID'),
  body('supervisorId')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const uuidRegex = /^[0-9a-fA-F-]{36}$/;
      if (!uuidRegex.test(String(value))) {
        throw new Error('supervisorId must be a valid UUID');
      }
      return true;
    }),
  body('serviceCenterId')
    .optional({ values: 'null' })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(String(value));
    })
    .withMessage('serviceCenterId must be a valid UUID or empty'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  body('isHr').optional().isBoolean().withMessage('isHr must be boolean'),
];

const registerEmployee = [
  body('fullName').trim().notEmpty().withMessage('fullName is required'),
  body('fullNameAr').optional().trim(),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().trim(),
  body('locationId').isUUID().withMessage('locationId is required and must be a valid UUID'),
  body('shiftId').isUUID().withMessage('shiftId is required and must be a valid UUID'),
  body('supervisorId')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const uuidRegex = /^[0-9a-fA-F-]{36}$/;
      if (!uuidRegex.test(String(value))) {
        throw new Error('supervisorId must be a valid UUID');
      }
      return true;
    }),
];

const registerServiceCenter = [
  body('fullName').trim().notEmpty().withMessage('fullName is required'),
  body('fullNameAr').optional().trim(),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().trim(),
  body('serviceCenterId')
    .notEmpty()
    .withMessage('serviceCenterId is required — select your service center')
    .isUUID()
    .withMessage('serviceCenterId must be a valid UUID'),
];

const updateUser = [
  param('id').isUUID().withMessage('Invalid user ID'),
  body('fullName').optional().trim().notEmpty().withMessage('fullName cannot be empty'),
  body('fullNameAr').optional().trim(),
  body('email').optional().trim().isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('userType')
    .optional()
    .isIn(userTypeValues)
    .withMessage(`userType must be one of: ${userTypeValues.join(', ')}`),
  body('role')
    .optional()
    .isIn(roleValues)
    .withMessage(`role must be one of: ${roleValues.join(', ')}`),
  body('jobTitle').optional().trim(),
  body('shiftId').optional({ checkFalsy: true }).isUUID().withMessage('shiftId must be a valid UUID'),
  body('locationId').optional({ checkFalsy: true }).isUUID().withMessage('locationId must be a valid UUID'),
  body('supervisorId')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const uuidRegex = /^[0-9a-fA-F-]{36}$/;
      if (!uuidRegex.test(String(value))) {
        throw new Error('supervisorId must be a valid UUID');
      }
      return true;
    }),
  body('serviceCenterId')
    .optional({ values: 'null' })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(String(value));
    })
    .withMessage('serviceCenterId must be a valid UUID or empty'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  body('isHr').optional().isBoolean().withMessage('isHr must be boolean'),
];

const userIdParam = [
  param('id').isUUID().withMessage('Invalid user ID'),
];

const changePassword = [
  param('id').isUUID().withMessage('Invalid user ID'),
  body('currentPassword').notEmpty().withMessage('currentPassword is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('newPassword must be at least 6 characters'),
];

const resetPassword = [
  param('id').isUUID().withMessage('Invalid user ID'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('newPassword must be at least 6 characters'),
];

const login = [
  body('email').trim().notEmpty().withMessage('email is required'),
  body('password').notEmpty().withMessage('password is required'),
];

const getUsersQuery = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  query('isActive').optional().isBoolean().toBoolean(),
  query('role').optional().isIn(roleValues),
  query('userType').optional().isIn(userTypeValues),
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('locationId').optional().isUUID().withMessage('locationId must be a valid UUID'),
  query('shiftId').optional().isUUID().withMessage('shiftId must be a valid UUID'),
];

const bulkAssignSupervisor = [
  body('userIds').isArray({ min: 1 }).withMessage('userIds must be an array'),
  body('userIds.*').isUUID().withMessage('Each userId must be a valid UUID'),
  body('supervisorId')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const uuidRegex = /^[0-9a-fA-F-]{36}$/;
      if (!uuidRegex.test(String(value))) {
        throw new Error('supervisorId must be a valid UUID');
      }
      return true;
    }),
  body('role').optional().isIn(roleValues).withMessage(`role must be one of: ${roleValues.join(', ')}`),
];

const getSupervisorsTreeQuery = [
  query('locationId').optional().isUUID().withMessage('locationId must be a valid UUID'),
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('includeInactive').optional().isBoolean().toBoolean(),
];

const getMyEmployeesQuery = [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('includeInactive').optional().isBoolean().toBoolean(),
];

const setAccessGrants = [
  body('userIds').isArray({ min: 1 }).withMessage('userIds must be an array'),
  body('userIds.*').isUUID().withMessage('Each userId must be a valid UUID'),
  body('codes').isArray().withMessage('codes must be an array'),
  body('codes.*').isString().withMessage('Each code must be a string'),
];

const approvePendingUser = [
  ...userIdParam,
  body('role').isIn(roleValues).withMessage(`role must be one of: ${roleValues.join(', ')}`),
];

const patchMyEmployeeRole = [
  ...userIdParam,
  body('role')
    .isIn(supervisorAssignableRoles)
    .withMessage(`role must be one of: ${supervisorAssignableRoles.join(', ')}`),
];

const approveSupervisorPendingUser = [
  ...userIdParam,
  body('role')
    .isIn(supervisorAssignableRoles)
    .withMessage(`role must be one of: ${supervisorAssignableRoles.join(', ')}`),
];

const getSignupSupervisorsQuery = [
  query('locationId').isUUID().withMessage('locationId must be a valid UUID'),
];

const viewerIdParam = [
  param('viewerId').isUUID().withMessage('viewerId must be a valid UUID'),
];

const setDelegatedVisibility = [
  ...viewerIdParam,
  body('visibleUserIds').isArray().withMessage('visibleUserIds must be an array'),
  body('visibleUserIds.*').isUUID().withMessage('Each visibleUserId must be a valid UUID'),
];

const activitySummaryDaysQuery = [
  query('days').optional().isInt({ min: 7, max: 30 }).withMessage('days must be 7–30').toInt(),
];

module.exports = {
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
  viewerIdParam,
  setDelegatedVisibility,
  activitySummaryDaysQuery,
};
