const { query, validationResult } = require('express-validator');

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

const listHrAttendanceQuery = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  query('dateFrom').optional().isISO8601().withMessage('dateFrom must be ISO date'),
  query('dateTo').optional().isISO8601().withMessage('dateTo must be ISO date'),
  query('shiftId').optional().isUUID().withMessage('shiftId must be a valid UUID'),
  query('locationId').optional().isUUID().withMessage('locationId must be a valid UUID'),
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('hasCheckIn').optional().isIn(['true', 'false']).toBoolean(),
  query('hasCheckOut').optional().isIn(['true', 'false']).toBoolean(),
];

const myDashboardChartDaysQuery = [
  query('days').optional().isInt({ min: 7, max: 30 }).withMessage('days must be 7–30').toInt(),
];

module.exports = {
  handleValidationErrors,
  listHrAttendanceQuery,
  myDashboardChartDaysQuery,
};

