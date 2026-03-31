const attendanceService = require('../services/attendanceService');
const userService = require('../../users/services/userService');

async function getStatus(req, res, next) {
  try {
    const latRaw = req.query?.lat;
    const lngRaw = req.query?.lng;
    const accRaw = req.query?.accuracyMeters;
    const lat = latRaw !== undefined ? Number(latRaw) : undefined;
    const lng = lngRaw !== undefined ? Number(lngRaw) : undefined;
    const accuracyMeters = accRaw !== undefined ? Number(accRaw) : undefined;
    const geo =
      latRaw !== undefined && lngRaw !== undefined && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng, accuracyMeters: Number.isFinite(accuracyMeters) ? accuracyMeters : undefined }
        : null;
    const result = await attendanceService.getShiftAwareStatus(req.user.id, geo);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function checkIn(req, res, next) {
  try {
    const lat = req.body?.lat !== undefined ? Number(req.body.lat) : undefined;
    const lng = req.body?.lng !== undefined ? Number(req.body.lng) : undefined;
    const accuracyMeters = req.body?.accuracyMeters !== undefined ? Number(req.body.accuracyMeters) : undefined;
    const geo =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng, accuracyMeters: Number.isFinite(accuracyMeters) ? accuracyMeters : undefined }
        : null;
    const result = await attendanceService.checkIn(req.user.id, geo);
    return res.json({ message: 'Checked in', ...result });
  } catch (err) {
    if (err.code === 'NO_SHIFT') return res.status(400).json({ error: err.message });
    if (err.code === 'TOO_EARLY') return res.status(400).json({ error: err.message });
    if (err.code === 'TOO_LATE') return res.status(400).json({ error: err.message });
    if (err.code === 'GEO_REQUIRED') return res.status(400).json({ error: err.message });
    if (err.code === 'OUTSIDE_ZONE') return res.status(403).json({ error: err.message });
    if (err.code === 'ALREADY_CHECKED_IN') return res.status(409).json({ error: err.message });
    next(err);
  }
}

async function checkOut(req, res, next) {
  try {
    const lat = req.body?.lat !== undefined ? Number(req.body.lat) : undefined;
    const lng = req.body?.lng !== undefined ? Number(req.body.lng) : undefined;
    const accuracyMeters = req.body?.accuracyMeters !== undefined ? Number(req.body.accuracyMeters) : undefined;
    const geo =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng, accuracyMeters: Number.isFinite(accuracyMeters) ? accuracyMeters : undefined }
        : null;
    const result = await attendanceService.checkOut(req.user.id, geo);
    return res.json({ message: 'Checked out', ...result });
  } catch (err) {
    if (err.code === 'NO_ACTIVE_CHECKIN') return res.status(400).json({ error: err.message });
    if (err.code === 'CHECKOUT_EXPIRED') return res.status(400).json({ error: err.message });
    if (err.code === 'GEO_REQUIRED') return res.status(400).json({ error: err.message });
    if (err.code === 'OUTSIDE_ZONE') return res.status(403).json({ error: err.message });
    next(err);
  }
}

async function listHrAttendance(req, res, next) {
  try {
    const {
      page,
      limit,
      dateFrom,
      dateTo,
      shiftId,
      locationId,
      q,
      hasCheckIn,
      hasCheckOut,
    } = req.query || {};
    const result = await attendanceService.listHrAttendance({
      page,
      limit,
      dateFrom,
      dateTo,
      shiftId,
      locationId,
      q,
      hasCheckIn,
      hasCheckOut,
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listSupervisorAttendance(req, res, next) {
  try {
    const {
      page,
      limit,
      dateFrom,
      dateTo,
      shiftId,
      locationId,
      q,
      hasCheckIn,
      hasCheckOut,
    } = req.query || {};
    const teamUserIds = await userService.getCompanyTeamUserIds(req.user.id);
    const result = await attendanceService.listHrAttendance({
      page,
      limit,
      dateFrom,
      dateTo,
      shiftId,
      locationId,
      q,
      hasCheckIn,
      hasCheckOut,
      teamUserIds,
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStatus,
  checkIn,
  checkOut,
  listHrAttendance,
  listSupervisorAttendance,
};

