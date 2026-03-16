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
  body('shiftId').optional().isUUID().withMessage('shiftId must be a valid UUID'),
  body('locationId').optional().isUUID().withMessage('locationId must be a valid UUID'),
  body('supervisorId').optional().isUUID().withMessage('supervisorId must be a valid UUID'),
  body('serviceCenterId')
    .optional()
    .isUUID()
    .withMessage('serviceCenterId must be a valid UUID'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
];

const registerEmployee = [
  body('fullName').trim().notEmpty().withMessage('fullName is required'),
  body('fullNameAr').optional().trim(),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().trim(),
  body('locationId').isUUID().withMessage('locationId is required and must be a valid UUID'),
  body('shiftId').isUUID().withMessage('shiftId is required and must be a valid UUID'),
  body('supervisorId').optional().isUUID().withMessage('supervisorId must be a valid UUID'),
];

const registerServiceCenter = [
  body('fullName').trim().notEmpty().withMessage('fullName is required'),
  body('fullNameAr').optional().trim(),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().trim(),
  body('serviceCenterId').optional().isUUID().withMessage('serviceCenterId must be a valid UUID'),
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
  body('shiftId').optional().isUUID().withMessage('shiftId must be a valid UUID'),
  body('locationId').optional().isUUID().withMessage('locationId must be a valid UUID'),
  body('supervisorId').optional().isUUID().withMessage('supervisorId must be a valid UUID'),
  body('serviceCenterId')
    .optional()
    .isUUID()
    .withMessage('serviceCenterId must be a valid UUID'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
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

const assignRole = [
  param('id').isUUID().withMessage('Invalid user ID'),
  body('role')
    .isIn(roleValues)
    .withMessage(`role must be one of: ${roleValues.join(', ')}`),
];

const assignPermissions = [
  param('id').isUUID().withMessage('Invalid user ID'),
  body('permissionIds')
    .isArray()
    .withMessage('permissionIds must be an array'),
  body('permissionIds.*').isUUID().withMessage('Each permissionId must be a valid UUID'),
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
  query('locationId').optional().isUUID().withMessage('locationId must be a valid UUID'),
];

module.exports = {
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
};
