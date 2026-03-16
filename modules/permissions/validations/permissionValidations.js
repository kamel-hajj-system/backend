const { body, param, query } = require('express-validator');
const { UserType } = require('../../users/models/constants');

const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((e) => ({ path: e.path, msg: e.msg })),
    });
  }
  next();
};

const userTypeValues = Object.values(UserType);

const idParam = [param('id').isUUID().withMessage('Invalid permission ID')];

const createPermission = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('module').optional().trim(),
  body('description').optional().trim(),
];

const updatePermission = [
  param('id').isUUID().withMessage('Invalid permission ID'),
  body('name').optional().trim().notEmpty().withMessage('name cannot be empty'),
  body('module').optional().trim(),
  body('description').optional().trim(),
];

const listQuery = [query('module').optional().trim()];

const getDefaultsQuery = [
  query('userType').optional().isIn(userTypeValues).withMessage(`userType must be one of: ${userTypeValues.join(', ')}`),
];

const setDefaultsBody = [
  body('userType').isIn(userTypeValues).withMessage(`userType must be one of: ${userTypeValues.join(', ')}`),
  body('permissionIds').isArray().withMessage('permissionIds must be an array'),
  body('permissionIds.*').isUUID().withMessage('Each permissionId must be a valid UUID'),
];

module.exports = {
  handleValidationErrors,
  idParam,
  createPermission,
  updatePermission,
  listQuery,
  getDefaultsQuery,
  setDefaultsBody,
};
