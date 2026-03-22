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
  '/reception/nationalities-overview',
  requireAuth,
  requireAccessCode(['reception.dashboard', 'reception.serviceCenters', 'reception.nationalities']),
  controller.listReceptionNationalitiesOverview
);

// Pilgrim nationalities (reference data)
router.get('/pilgrim-nationalities', requireAuth, requireSuperAdmin, controller.listNationalities);
router.post(
  '/pilgrim-nationalities/sync-arriving-totals',
  requireAuth,
  requireSuperAdmin,
  sensitiveLimiter,
  controller.syncAllNationalityArrivingTotals
);
router.get(
  '/pilgrim-nationalities/:id/overview',
  requireAuth,
  requireSuperAdmin,
  uuidParam,
  handleValidationErrors,
  controller.getNationalityOverview
);
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
