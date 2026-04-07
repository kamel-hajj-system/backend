const express = require('express');
const controller = require('./serviceCenterPreArrivalAdminController');
const { requireAuth, requireSuperAdmin } = require('../users/middleware');

const router = express.Router();

router.get(
  '/superadmin/service-center-pre-arrival/settings',
  requireAuth,
  requireSuperAdmin,
  controller.getSettings
);
router.put(
  '/superadmin/service-center-pre-arrival/settings',
  requireAuth,
  requireSuperAdmin,
  controller.putSettings
);

module.exports = router;
