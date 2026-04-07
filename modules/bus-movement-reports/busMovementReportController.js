const service = require('./busMovementReportService');

function requireCompanyLocation(req, res) {
  if (req.user?.userType !== 'Company') {
    res.status(403).json({ error: 'Company access required' });
    return null;
  }
  if (!req.user?.locationId) {
    res.status(400).json({ error: 'User has no work location assigned' });
    return null;
  }
  return req.user.locationId;
}

function hasAirportAccess(req) {
  if (req.isSuperAdmin) return true;
  if (req.user?.userType !== 'Company') return false;
  if (req.user?.role === 'Supervisor') return true;
  const codes = req.user?.accessCodes || [];
  return codes.includes('portal.company.buses_reception');
}

function hasAdminAccess(req) {
  if (req.isSuperAdmin) return true;
  const codes = req.user?.accessCodes || [];
  return codes.includes('portal.company.buses_reception_admin');
}

async function getSummary(req, res, next) {
  try {
    if (!hasAirportAccess(req)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const locationId = requireCompanyLocation(req, res);
    if (!locationId) return;
    const summary = await service.summaryForLocation(locationId);
    return res.json(summary);
  } catch (e) {
    next(e);
  }
}

async function listAirport(req, res, next) {
  try {
    if (!hasAirportAccess(req)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const locationId = requireCompanyLocation(req, res);
    if (!locationId) return;
    const isSupervisor = req.user?.role === 'Supervisor';
    const rows = await service.listAirport({
      locationId,
      userId: req.userId,
      isSupervisor,
    });
    return res.json(rows);
  } catch (e) {
    next(e);
  }
}

async function listAdmin(req, res, next) {
  try {
    if (!hasAdminAccess(req)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const locationId = requireCompanyLocation(req, res);
    if (!locationId) return;
    const rows = await service.listAdmin({ locationId });
    return res.json(rows);
  } catch (e) {
    next(e);
  }
}

async function getSummaryAdmin(req, res, next) {
  try {
    if (!hasAdminAccess(req)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const locationId = requireCompanyLocation(req, res);
    if (!locationId) return;
    const summary = await service.summaryForLocation(locationId);
    return res.json(summary);
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    if (!hasAirportAccess(req)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const locationId = requireCompanyLocation(req, res);
    if (!locationId) return;
    const b = req.body || {};
    if (!String(b.companyName || '').trim()) {
      return res.status(400).json({ error: 'companyName is required' });
    }
    if (!String(b.busNumber || '').trim()) {
      return res.status(400).json({ error: 'busNumber is required' });
    }
    const report = await service.createReport({
      locationId,
      createdById: req.userId,
      body: b,
    });
    return res.status(201).json(report);
  } catch (e) {
    next(e);
  }
}

async function supervisorApprove(req, res, next) {
  try {
    if (req.user?.userType !== 'Company' || req.user?.role !== 'Supervisor') {
      return res.status(403).json({ error: 'Supervisor access required' });
    }
    const locationId = requireCompanyLocation(req, res);
    if (!locationId) return;
    const { id } = req.params;
    const result = await service.supervisorApprove({
      id,
      locationId,
      supervisorUserId: req.userId,
      body: req.body || {},
    });
    if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'Not found' });
    if (result.error === 'INVALID_STATUS') {
      return res.status(400).json({ error: 'Report cannot be approved in its current status' });
    }
    return res.json(result.report);
  } catch (e) {
    next(e);
  }
}

async function adminUpdate(req, res, next) {
  try {
    if (!hasAdminAccess(req)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const locationId = requireCompanyLocation(req, res);
    if (!locationId) return;
    const { id } = req.params;
    const result = await service.adminUpdate({
      id,
      locationId,
      adminUserId: req.userId,
      body: req.body || {},
    });
    if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'Not found' });
    if (result.error === 'INVALID_STATUS') {
      return res.status(400).json({ error: 'Report must be approved by airport supervisor first' });
    }
    return res.json(result.report);
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getSummary,
  getSummaryAdmin,
  listAirport,
  listAdmin,
  create,
  supervisorApprove,
  adminUpdate,
};
