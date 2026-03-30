const { body, param, validationResult } = require('express-validator');

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

const uuidParam = [param('id').isUUID().withMessage('Invalid id')];

const createServiceCenter = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('code is required (e.g. 110)')
    .isLength({ max: 64 })
    .withMessage('code is too long'),
  body('presidentName').optional().trim(),
  body('vicePresidentName').optional().trim(),
  body('maxCapacity').optional().isInt({ min: 0 }).withMessage('maxCapacity must be a non-negative integer'),
  body('companies').optional().isArray(),
  body('companies.*.pilgrimCompanyId').optional().isUUID(),
  body('companies.*.allocatedPilgrims').optional().isInt({ min: 0 }),
];

const optionalNonNegIntOrNull = (field) =>
  body(field)
    .optional({ values: 'null' })
    .custom((v) => v === null || v === undefined || (Number.isInteger(v) && v >= 0))
    .withMessage('Must be null or a non-negative integer');

const updateServiceCenter = [
  param('id').isUUID().withMessage('Invalid service center id'),
  body('code')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('code cannot be empty')
    .isLength({ max: 64 }),
  body('presidentName').optional().trim(),
  body('vicePresidentName').optional().trim(),
  optionalNonNegIntOrNull('maxCapacity'),
  body('companies').optional().isArray(),
  body('companies.*.pilgrimCompanyId').optional().isUUID(),
  body('companies.*.allocatedPilgrims').optional().isInt({ min: 0 }),
];

const createPilgrimNationality = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('nameAr').optional().trim(),
  body('code').optional().trim(),
  body('flagCode').optional().trim().isLength({ max: 32 }).withMessage('flagCode is too long'),
  body('notes').optional().trim(),
];

const updatePilgrimNationality = [
  param('id').isUUID().withMessage('Invalid id'),
  body('name').optional().trim().notEmpty(),
  body('nameAr').optional().trim(),
  body('code').optional().trim(),
  body('flagCode').optional().trim().isLength({ max: 32 }).withMessage('flagCode is too long'),
  body('notes').optional().trim(),
];

const createPilgrimCompany = [
  body('externalCode').trim().notEmpty().withMessage('externalCode is required'),
  body('name').trim().notEmpty().withMessage('name is required'),
  body('nameAr').optional().trim(),
  body('notes').optional().trim(),
  body('expectedPilgrimsCount').isInt({ min: 0 }).withMessage('expectedPilgrimsCount is required'),
  body('mergedActualPilgrimsCount').optional({ values: 'null' }).isInt({ min: 0 }),
  body('nationalityIds').optional().isArray(),
  body('nationalityIds.*').optional().isUUID(),
];

const updatePilgrimCompany = [
  param('id').isUUID().withMessage('Invalid id'),
  body('externalCode').optional().trim().notEmpty(),
  body('name').optional().trim().notEmpty(),
  body('nameAr').optional().trim(),
  body('notes').optional().trim(),
  body('expectedPilgrimsCount').optional().isInt({ min: 0 }),
  body('mergedActualPilgrimsCount').optional({ values: 'null' }).isInt({ min: 0 }),
  body('nationalityIds').optional().isArray(),
  body('nationalityIds.*').optional().isUUID(),
];

module.exports = {
  handleValidationErrors,
  uuidParam,
  createServiceCenter,
  updateServiceCenter,
  createPilgrimNationality,
  updatePilgrimNationality,
  createPilgrimCompany,
  updatePilgrimCompany,
};
