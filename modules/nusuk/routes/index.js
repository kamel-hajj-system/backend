const express = require('express');
const controller = require('../nusukController');
const { requireAuth, requireAccessCode, requireServiceCenterPortal } = require('../../users/middleware');
const { uuidParam, handleValidationErrors } = require('../../service-centers/validations/serviceCenterValidations');

const router = express.Router();

const receptionNusukAccess = [
  'reception.dashboard',
  'reception.serviceCenters',
  'reception.pilgrimCompanies',
  'reception.nusukData',
  'reception.nusuk_rows',
];

/** Must match Super Admin → Access Control leaf `reception.nusuk_input_monitoring` (not implied by `reception.nusuk_rows`). */
const receptionNusukInputMonitoringOnly = ['reception.nusuk_input_monitoring'];

router.get('/reception/nusuk-data', requireAuth, requireAccessCode(receptionNusukAccess), controller.list);
router.get(
  '/reception/nusuk-data/summary-stats',
  requireAuth,
  requireAccessCode(receptionNusukAccess),
  controller.getReceptionNusukRowsSummary
);
router.get(
  '/reception/nusuk-data/dashboard-stats',
  requireAuth,
  requireAccessCode(receptionNusukAccess),
  controller.getReceptionDashboardStats
);
router.get(
  '/reception/nusuk-data/dashboard-port-breakdown',
  requireAuth,
  requireAccessCode(receptionNusukAccess),
  controller.getReceptionDashboardPortBreakdown
);
router.get(
  '/reception/nusuk-data/sheet-compare-flags',
  requireAuth,
  requireAccessCode(receptionNusukAccess),
  controller.getNusukSheetCompareFlags
);
router.get(
  '/reception/nusuk-input-monitoring',
  requireAuth,
  requireAccessCode(receptionNusukInputMonitoringOnly),
  controller.listNusukInputMonitoring
);
router.get('/reception/nusuk-columns-config', requireAuth, requireAccessCode(receptionNusukAccess), controller.getColumnsConfig);

/** Service center home: KPI aggregates (no full row list). */
router.get(
  '/service-center/dashboard-summary',
  requireAuth,
  requireServiceCenterPortal,
  controller.getServiceCenterDashboardSummary
);
router.get(
  '/service-center/dashboard-pre-arrival-by-arrival-date',
  requireAuth,
  requireServiceCenterPortal,
  controller.getServiceCenterPreArrivalByArrivalDate
);
/** Service center portal: Nusuk rows filtered by sheet column رقم مركز الخدمة = ServiceCenter.code */
router.get('/service-center/nusuk-data', requireAuth, requireServiceCenterPortal, controller.listForServiceCenter);
router.get(
  '/service-center/nusuk-data/:id',
  requireAuth,
  requireServiceCenterPortal,
  ...uuidParam,
  handleValidationErrors,
  controller.getOneForServiceCenter
);
router.patch(
  '/service-center/nusuk-data/:id',
  requireAuth,
  requireServiceCenterPortal,
  ...uuidParam,
  handleValidationErrors,
  controller.updateServiceCenter
);

router.post('/reception/nusuk-data/sync', requireAuth, requireAccessCode(receptionNusukAccess), controller.sync);
router.post('/reception/nusuk-data/sync-preview', requireAuth, requireAccessCode(receptionNusukAccess), controller.previewSync);
router.post('/reception/nusuk-data/sync-save', requireAuth, requireAccessCode(receptionNusukAccess), controller.saveSync);
router.post(
  '/reception/nusuk-data/:id/edit-lock',
  requireAuth,
  requireAccessCode(receptionNusukAccess),
  ...uuidParam,
  handleValidationErrors,
  controller.acquireEditLock
);
router.delete(
  '/reception/nusuk-data/:id/edit-lock',
  requireAuth,
  requireAccessCode(receptionNusukAccess),
  ...uuidParam,
  handleValidationErrors,
  controller.releaseEditLock
);
router.post(
  '/reception/nusuk-data/:id/edit-lock/heartbeat',
  requireAuth,
  requireAccessCode(receptionNusukAccess),
  ...uuidParam,
  handleValidationErrors,
  controller.heartbeatEditLock
);
router.get(
  '/reception/nusuk-data/:id/pilgrim-sheet-suggestions',
  requireAuth,
  requireAccessCode(receptionNusukAccess),
  ...uuidParam,
  handleValidationErrors,
  controller.getPilgrimSheetSuggestions
);
router.get(
  '/reception/nusuk-data/:id/sheet-compare-detail',
  requireAuth,
  requireAccessCode(receptionNusukAccess),
  ...uuidParam,
  handleValidationErrors,
  controller.getNusukSheetCompareDetail
);
router.patch('/reception/nusuk-data/:id', requireAuth, requireAccessCode(receptionNusukAccess), controller.update);

module.exports = router;
