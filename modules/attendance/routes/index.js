const express = require('express');
const controller = require('../controllers/attendanceController');
const requestController = require('../controllers/attendanceRequestController');
const { uploadAbsenceAttachment } = require('../middleware/attendanceRequestUpload');
const { requireAuth, requireHr, requireCompanySupervisorOrAccessCodes } = require('../../users/middleware');
const {
  handleValidationErrors,
  listHrAttendanceQuery,
  myDashboardChartDaysQuery,
} = require('../validations/attendanceValidations');
const { uuidParam } = require('../../service-centers/validations/serviceCenterValidations');

const router = express.Router();

function uploadAbsenceOptional(req, res, next) {
  uploadAbsenceAttachment.single('attachment')(req, res, (err) => {
    if (!err) return next();
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 400;
    return res.status(status).json({ error: err.message || 'Upload failed', code: err.code });
  });
}

// Company users (Supervisor/Employee) - shift-aware attendance
router.get('/attendance/status', requireAuth, controller.getStatus);
router.post('/attendance/check-in', requireAuth, controller.checkIn);
router.post('/attendance/check-out', requireAuth, controller.checkOut);
router.get(
  '/attendance/mine/chart-series',
  requireAuth,
  myDashboardChartDaysQuery,
  handleValidationErrors,
  controller.getMyAttendanceChart
);

// HR - attendance overview
router.get('/hr/attendance', requireAuth, requireHr, listHrAttendanceQuery, handleValidationErrors, controller.listHrAttendance);

// Company supervisor or delegated team viewer — read-only attendance for team ∪ delegated users
router.get(
  '/portal/company/supervisor/attendance',
  requireAuth,
  requireCompanySupervisorOrAccessCodes('portal.supervisor.attendance'),
  listHrAttendanceQuery,
  handleValidationErrors,
  controller.listSupervisorAttendance
);

// --- Attendance requests (work location / sick leave) — does not change check-in/out logic ---
router.post(
  '/attendance/requests/work-location',
  requireAuth,
  requestController.requireCompanyPortalUser,
  requestController.createWorkLocation
);
router.post(
  '/attendance/requests/absence',
  requireAuth,
  requestController.requireCompanyPortalUser,
  uploadAbsenceOptional,
  requestController.createAbsence
);
router.get('/attendance/requests/mine', requireAuth, requestController.requireCompanyPortalUser, requestController.listMine);
router.get(
  '/portal/company/supervisor/attendance-requests',
  requireAuth,
  requireCompanySupervisorOrAccessCodes('portal.supervisor.attendance'),
  requestController.listSupervisor
);
router.get('/hr/attendance-requests', requireAuth, requireHr, requestController.listHr);
router.patch(
  '/attendance/requests/:id/decision',
  requireAuth,
  requestController.requireCompanyPortalUser,
  ...uuidParam,
  handleValidationErrors,
  requestController.decide
);
router.get(
  '/attendance/requests/:id/attachment',
  requireAuth,
  ...uuidParam,
  handleValidationErrors,
  requestController.downloadAttachment
);

module.exports = router;

