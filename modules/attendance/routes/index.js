const express = require('express');
const controller = require('../controllers/attendanceController');
const { requireAuth, requireHr, requireCompanySupervisorOrAccessCodes } = require('../../users/middleware');
const { handleValidationErrors, listHrAttendanceQuery } = require('../validations/attendanceValidations');

const router = express.Router();

// Company users (Supervisor/Employee) - shift-aware attendance
router.get('/attendance/status', requireAuth, controller.getStatus);
router.post('/attendance/check-in', requireAuth, controller.checkIn);
router.post('/attendance/check-out', requireAuth, controller.checkOut);

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

module.exports = router;

