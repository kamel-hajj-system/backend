const express = require('express');
const adminController = require('./nusukAdminController');
const controller = require('./nusukController');
const { requireAuth, requireSuperAdmin } = require('../users/middleware');
const { uuidParam, handleValidationErrors } = require('../service-centers/validations/serviceCenterValidations');

const router = express.Router();

router.get('/superadmin/nusuk/settings', requireAuth, requireSuperAdmin, adminController.getSettings);
router.put('/superadmin/nusuk/settings', requireAuth, requireSuperAdmin, adminController.putSettings);
router.get('/superadmin/nusuk/columns-config', requireAuth, requireSuperAdmin, adminController.getColumnsConfig);
router.put('/superadmin/nusuk/columns-config', requireAuth, requireSuperAdmin, adminController.putColumnsConfig);
router.get('/superadmin/nusuk/snapshots', requireAuth, requireSuperAdmin, adminController.listSnapshots);
router.post('/superadmin/nusuk/snapshots', requireAuth, requireSuperAdmin, adminController.createSnapshot);
router.post(
  '/superadmin/nusuk/snapshots/:id/restore',
  requireAuth,
  requireSuperAdmin,
  ...uuidParam,
  handleValidationErrors,
  adminController.restoreSnapshot
);
router.post('/superadmin/nusuk/truncate', requireAuth, requireSuperAdmin, adminController.truncate);
router.post('/superadmin/nusuk/sync', requireAuth, requireSuperAdmin, adminController.sync);
router.post(
  '/superadmin/nusuk/rows/:id/edit-lock',
  requireAuth,
  requireSuperAdmin,
  ...uuidParam,
  handleValidationErrors,
  controller.acquireEditLock
);
router.delete(
  '/superadmin/nusuk/rows/:id/edit-lock',
  requireAuth,
  requireSuperAdmin,
  ...uuidParam,
  handleValidationErrors,
  controller.releaseEditLock
);
router.post(
  '/superadmin/nusuk/rows/:id/edit-lock/heartbeat',
  requireAuth,
  requireSuperAdmin,
  ...uuidParam,
  handleValidationErrors,
  controller.heartbeatEditLock
);
router.patch(
  '/superadmin/nusuk/rows/:id',
  requireAuth,
  requireSuperAdmin,
  ...uuidParam,
  handleValidationErrors,
  adminController.updateRow
);

/** Same list payload as reception (for Super Admin page). */
router.get('/superadmin/nusuk/data', requireAuth, requireSuperAdmin, controller.list);

module.exports = router;
