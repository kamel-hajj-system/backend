const express = require('express');
const controller = require('../controllers/attendanceController');
const { requireAuth, requireHr } = require('../../users/middleware');
const { handleValidationErrors, listHrAttendanceQuery } = require('../validations/attendanceValidations');

const router = express.Router();

// Company users (Supervisor/Employee) - shift-aware attendance
router.get('/attendance/status', requireAuth, controller.getStatus);
router.post('/attendance/check-in', requireAuth, controller.checkIn);
router.post('/attendance/check-out', requireAuth, controller.checkOut);

// HR - attendance overview
router.get('/hr/attendance', requireAuth, requireHr, listHrAttendanceQuery, handleValidationErrors, controller.listHrAttendance);

module.exports = router;

