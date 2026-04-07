const express = require('express');
const controller = require('../controllers/serviceCenterController');
const { requireAuth, requireSuperAdmin, requireAccessCode, sensitiveLimiter } = require('../../users/middleware');
const {
  handleValidationErrors,
  uuidParam,
  createServiceCenter,
  updateServiceCenter,
  createPilgrimNationality,
  updatePilgrimNationality,
  createPilgrimCompany,
  updatePilgrimCompany,
} = require('../validations/serviceCenterValidations');

const router = express.Router();

// Public: centers for service-center signup (no auth)
router.get('/public/service-centers', controller.listPublicCatalog);

// Reception portal: service center dashboard (company users with reception.dashboard)
router.get(
  '/reception/service-centers-overview',
  requireAuth,
  requireAccessCode(['reception.dashboard', 'reception.serviceCenters']),
  controller.listReceptionOverview
);
router.get(
  '/reception/service-centers/:id/users',
  requireAuth,
  requireAccessCode(['reception.dashboard', 'reception.serviceCenters']),
  uuidParam,
  handleValidationErrors,
  controller.listReceptionCenterUsers
);
router.get(
  '/reception/pilgrim-companies-overview',
  requireAuth,
  requireAccessCode(['reception.dashboard', 'reception.pilgrimCompanies']),
  controller.listReceptionPilgrimCompaniesOverview
);
router.get(
  '/reception/pilgrim-nationalities-overview',
  requireAuth,
  requireAccessCode(['reception.nationalities']),
  controller.listReceptionNationalitiesOverview
);
// Pilgrim nationalities (reference data)
router.get('/pilgrim-nationalities', requireAuth, requireSuperAdmin, controller.listNationalities);
router.get(
  '/pilgrim-nationalities/:id',
  requireAuth,
  requireSuperAdmin,
  uuidParam,
  handleValidationErrors,
  controller.getNationality
);
router.post(
  '/pilgrim-nationalities',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  createPilgrimNationality,
  handleValidationErrors,
  controller.createNationality
);
router.patch(
  '/pilgrim-nationalities/:id',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  updatePilgrimNationality,
  handleValidationErrors,
  controller.updateNationality
);
router.delete(
  '/pilgrim-nationalities/:id',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  uuidParam,
  handleValidationErrors,
  controller.deleteNationality
);

// Pilgrim companies
router.get('/pilgrim-companies', requireAuth, requireSuperAdmin, controller.listPilgrimCompanies);
router.get(
  '/pilgrim-companies/:id',
  requireAuth,
  requireSuperAdmin,
  uuidParam,
  handleValidationErrors,
  controller.getPilgrimCompany
);
router.post(
  '/pilgrim-companies',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  createPilgrimCompany,
  handleValidationErrors,
  controller.createPilgrimCompany
);
router.patch(
  '/pilgrim-companies/:id',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  updatePilgrimCompany,
  handleValidationErrors,
  controller.updatePilgrimCompany
);
router.delete(
  '/pilgrim-companies/:id',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  uuidParam,
  handleValidationErrors,
  controller.deletePilgrimCompany
);

// Service centers
router.get('/service-centers', requireAuth, requireSuperAdmin, controller.listCenters);
router.get(
  '/service-centers/:id/users',
  requireAuth,
  requireSuperAdmin,
  uuidParam,
  handleValidationErrors,
  controller.listCenterUsers
);
router.get('/service-centers/:id', requireAuth, requireSuperAdmin, uuidParam, handleValidationErrors, controller.getCenter);
router.post(
  '/service-centers',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  createServiceCenter,
  handleValidationErrors,
  controller.createCenter
);
router.patch(
  '/service-centers/:id',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  updateServiceCenter,
  handleValidationErrors,
  controller.updateCenter
);
router.delete(
  '/service-centers/:id',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  uuidParam,
  handleValidationErrors,
  controller.deleteCenter
);

module.exports = router;
