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

const idParam = [param('id').isUUID().withMessage('Invalid location ID')];

const createLocation = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
];

const updateLocation = [
  param('id').isUUID().withMessage('Invalid location ID'),
  body('name').optional().trim().notEmpty().withMessage('name cannot be empty'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
];

const listQuery = [
  query('isActive').optional().isIn(['true', 'false']),
];

module.exports = {
  handleValidationErrors,
  idParam,
  createLocation,
  updateLocation,
  listQuery,
};
