const express = require('express');
const controller = require('./busMovementReportController');
const { requireAuth } = require('../users/middleware');

const router = express.Router();

router.get('/portal/company/buses/movement-reports/summary', requireAuth, controller.getSummary);
router.get('/portal/company/buses/movement-reports', requireAuth, controller.listAirport);
router.post('/portal/company/buses/movement-reports', requireAuth, controller.create);
router.patch(
  '/portal/company/buses/movement-reports/:id/supervisor-approve',
  requireAuth,
  controller.supervisorApprove
);

router.get('/portal/company/buses/admin/movement-reports/summary', requireAuth, controller.getSummaryAdmin);
router.get('/portal/company/buses/admin/movement-reports', requireAuth, controller.listAdmin);
router.patch('/portal/company/buses/admin/movement-reports/:id', requireAuth, controller.adminUpdate);

module.exports = router;
