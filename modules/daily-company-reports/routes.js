const express = require('express');
const controller = require('./dailyCompanyReportController');
const { requireAuth } = require('../users/middleware');

const router = express.Router();

router.get('/portal/company/daily-reports/summary', requireAuth, controller.getSummarySubmit);
router.get('/portal/company/daily-reports/monitoring/summary', requireAuth, controller.getSummaryMonitoring);
router.get('/portal/company/daily-reports/monitoring', requireAuth, controller.listMonitoring);
router.get('/portal/company/daily-reports', requireAuth, controller.listMine);
router.post('/portal/company/daily-reports', requireAuth, controller.postReport);
router.get('/portal/company/daily-reports/:id', requireAuth, controller.getOne);

module.exports = router;
