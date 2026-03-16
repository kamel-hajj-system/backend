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

const idParam = [param('id').isUUID().withMessage('Invalid shift ID')];

const createShift = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('shiftAr').optional().trim().notEmpty().withMessage('shiftAr cannot be empty'),
  body('startTime').notEmpty().withMessage('startTime is required'),
  body('endTime').notEmpty().withMessage('endTime is required'),
  body('isForEmployee').optional().isBoolean().withMessage('isForEmployee must be boolean'),
];

const updateShift = [
  param('id').isUUID().withMessage('Invalid shift ID'),
  body('name').optional().trim().notEmpty().withMessage('name cannot be empty'),
  body('shiftAr').optional().trim().notEmpty().withMessage('shiftAr cannot be empty'),
  body('startTime').optional(),
  body('endTime').optional(),
  body('isForEmployee').optional().isBoolean().withMessage('isForEmployee must be boolean'),
];

const listQuery = [query('isForEmployee').optional().isIn(['true', 'false'])];

module.exports = {
  handleValidationErrors,
  idParam,
  createShift,
  updateShift,
  listQuery,
};
