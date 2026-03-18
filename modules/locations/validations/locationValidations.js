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
  body('locationAr').optional().trim().notEmpty().withMessage('locationAr cannot be empty'),
  body('zoneCenterLat').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }).toFloat(),
  body('zoneCenterLng').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }).toFloat(),
  body('zoneRadiusMeters').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1, max: 20000 }).toInt(),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
];

const updateLocation = [
  param('id').isUUID().withMessage('Invalid location ID'),
  body('name').optional().trim().notEmpty().withMessage('name cannot be empty'),
  body('locationAr').optional().trim().notEmpty().withMessage('locationAr cannot be empty'),
  body('zoneCenterLat').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }).toFloat(),
  body('zoneCenterLng').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }).toFloat(),
  body('zoneRadiusMeters').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1, max: 20000 }).toInt(),
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
