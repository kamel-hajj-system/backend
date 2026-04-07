const express = require('express');
const controller = require('./pilgrimCompanySheetController');
const { requireAuth, requireSuperAdmin, requireAccessCode } = require('../users/middleware');
const { uuidParam, handleValidationErrors } = require('../service-centers/validations/serviceCenterValidations');

const router = express.Router();

const receptionAccess = [
  'reception.dashboard',
  'reception.serviceCenters',
  'reception.pilgrimCompanies',
  'reception.nusukData',
  'reception.nusuk_rows',
  'reception.pilgrimCompanySheets',
  'reception.pilgrimCompanyData',
];

router.get('/superadmin/pilgrim-company-sheets', requireAuth, requireSuperAdmin, controller.list);
router.post('/superadmin/pilgrim-company-sheets', requireAuth, requireSuperAdmin, controller.create);
router.patch(
  '/superadmin/pilgrim-company-sheets/:id',
  requireAuth,
  requireSuperAdmin,
  ...uuidParam,
  handleValidationErrors,
  controller.update
);
router.delete(
  '/superadmin/pilgrim-company-sheets/:id',
  requireAuth,
  requireSuperAdmin,
  ...uuidParam,
  handleValidationErrors,
  controller.remove
);

router.get(
  '/reception/pilgrim-company-data/overview',
  requireAuth,
  requireAccessCode(receptionAccess),
  controller.dataOverview
);
router.get(
  '/reception/pilgrim-company-sheets',
  requireAuth,
  requireAccessCode(receptionAccess),
  controller.list
);
router.get(
  '/reception/pilgrim-company-sheets/:id/preview',
  requireAuth,
  requireAccessCode(receptionAccess),
  ...uuidParam,
  handleValidationErrors,
  controller.preview
);
router.post(
  '/reception/pilgrim-company-sheets/:id/apply-field-to-nusuk',
  requireAuth,
  requireAccessCode(receptionAccess),
  ...uuidParam,
  handleValidationErrors,
  controller.applyFieldToNusuk
);
router.post(
  '/reception/pilgrim-company-sheets/:id/apply-all-empty-fields-to-nusuk',
  requireAuth,
  requireAccessCode(receptionAccess),
  ...uuidParam,
  handleValidationErrors,
  controller.applyAllEmptyFieldsToNusuk
);

module.exports = router;
