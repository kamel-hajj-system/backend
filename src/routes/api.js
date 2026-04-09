const express = require('express');
const { Pool } = require('pg');

const router = express.Router();
const userRoutes = require('../../modules/users/routes');
const locationRoutes = require('../../modules/locations/routes');
const shiftRoutes = require('../../modules/shifts/routes');
const attendanceRoutes = require('../../modules/attendance/routes');
const notificationRoutes = require('../../modules/notifications/routes');
const pushRoutes = require('../../modules/push/routes');
const serviceCenterRoutes = require('../../modules/service-centers/routes');
const nusukRoutes = require('../../modules/nusuk/routes');
const nusukAdminRoutes = require('../../modules/nusuk/nusukAdminRoutes');
const serviceCenterPreArrivalAdminRoutes = require('../../modules/service-center-pre-arrival/serviceCenterPreArrivalAdminRoutes');
const pilgrimCompanySheetRoutes = require('../../modules/pilgrim-company-sheets/pilgrimCompanySheetRoutes');
const busMovementReportRoutes = require('../../modules/bus-movement-reports/routes');
const dailyCompanyReportRoutes = require('../../modules/daily-company-reports/routes');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

router.get('/health', (req, res) => {
  res.json({ message: 'API router is working' });
});

router.get('/db-health', async (req, res) => {
  try {
    const result = await pool.query('SELECT 1 AS ok');
    return res.json({ status: 'ok', details: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ status: 'error', error: error.message });
  }
});

router.use('/', userRoutes);
router.use('/', locationRoutes);
router.use('/', shiftRoutes);
router.use('/', attendanceRoutes);
router.use('/', notificationRoutes);
router.use('/', pushRoutes);
router.use('/', serviceCenterRoutes);
router.use('/', nusukRoutes);
router.use('/', nusukAdminRoutes);
router.use('/', serviceCenterPreArrivalAdminRoutes);
router.use('/', pilgrimCompanySheetRoutes);
router.use('/', busMovementReportRoutes);
router.use('/', dailyCompanyReportRoutes);

module.exports = router;
