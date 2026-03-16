const { body, param, query } = require('express-validator');

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

const idParam = [param('id').isUUID().withMessage('Invalid group ID')];

const createGroup = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('locationId').optional().isUUID().withMessage('locationId must be a valid UUID'),
  body('description').optional().trim(),
];

const updateGroup = [
  body('name').optional().trim().notEmpty().withMessage('name cannot be empty'),
  body('locationId').optional().isUUID().withMessage('locationId must be a valid UUID'),
  body('description').optional().trim(),
];

const listQuery = [query('locationId').optional().isUUID().withMessage('locationId must be a valid UUID')];

const setPermissionsBody = [
  body('permissionIds').isArray().withMessage('permissionIds must be an array'),
  body('permissionIds.*').isUUID().withMessage('Each permissionId must be a valid UUID'),
];

const setUsersBody = [
  body('userIds').isArray().withMessage('userIds must be an array'),
  body('userIds.*').isUUID().withMessage('Each userId must be a valid UUID'),
];

module.exports = {
  handleValidationErrors,
  idParam,
  createGroup,
  updateGroup,
  listQuery,
  setPermissionsBody,
  setUsersBody,
};
