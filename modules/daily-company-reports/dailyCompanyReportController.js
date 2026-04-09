const service = require('./dailyCompanyReportService');

const ACCESS_SUBMIT = 'portal.company.daily_report';
const ACCESS_MONITOR = 'portal.company.daily_reports_monitoring';

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

function canSubmit(req) {
  if (req.user?.userType !== 'Company') return false;
  if (req.user?.role === 'Supervisor') return true;
  const codes = req.user?.accessCodes || [];
  return codes.includes(ACCESS_SUBMIT);
}

function canMonitor(req) {
  if (req.user?.userType !== 'Company') return false;
  if (req.user?.role === 'Supervisor') return true;
  const codes = req.user?.accessCodes || [];
  return codes.includes(ACCESS_MONITOR);
}

async function postReport(req, res, next) {
  try {
    if (!canSubmit(req)) return res.status(403).json({ error: 'Access denied' });
    const locationId = requireCompanyLocation(req, res);
    if (!locationId) return;
    const row = await service.createReport({
      locationId,
      userId: req.userId,
      body: req.body || {},
    });
    return res.status(201).json(row);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
    next(e);
  }
}

async function getSummarySubmit(req, res, next) {
  try {
    if (!canSubmit(req)) return res.status(403).json({ error: 'Access denied' });
    const locationId = requireCompanyLocation(req, res);
    if (!locationId) return;
    const summary = await service.summaryForLocation(locationId, { userId: req.userId, mode: 'mine' });
    return res.json(summary);
  } catch (e) {
    next(e);
  }
}

async function getSummaryMonitoring(req, res, next) {
  try {
    if (!canMonitor(req)) return res.status(403).json({ error: 'Access denied' });
    const locationId = requireCompanyLocation(req, res);
    if (!locationId) return;
    const summary = await service.summaryForLocation(locationId, { userId: req.userId, mode: 'all' });
    return res.json(summary);
  } catch (e) {
    next(e);
  }
}

async function listMine(req, res, next) {
  try {
    if (!canSubmit(req)) return res.status(403).json({ error: 'Access denied' });
    const locationId = requireCompanyLocation(req, res);
    if (!locationId) return;
    const { from, to } = req.query || {};
    const rows = await service.listMine({ locationId, userId: req.userId, from, to });
    return res.json(rows);
  } catch (e) {
    next(e);
  }
}

async function listMonitoring(req, res, next) {
  try {
    if (!canMonitor(req)) return res.status(403).json({ error: 'Access denied' });
    const locationId = requireCompanyLocation(req, res);
    if (!locationId) return;
    const { q, from, to } = req.query || {};
    const rows = await service.listMonitoring({ locationId, q, from, to });
    return res.json(rows);
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const locationId = requireCompanyLocation(req, res);
    if (!locationId) return;
    const { id } = req.params;
    const row = await service.getById(id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.locationId !== locationId) return res.status(403).json({ error: 'Access denied' });
    const isOwner = row.createdById === req.userId;
    if (isOwner && !canSubmit(req)) return res.status(403).json({ error: 'Access denied' });
    if (!isOwner && !canMonitor(req)) return res.status(403).json({ error: 'Access denied' });
    const { createdById, locationId: _loc, ...rest } = row;
    return res.json(rest);
  } catch (e) {
    next(e);
  }
}

module.exports = {
  postReport,
  getSummarySubmit,
  getSummaryMonitoring,
  listMine,
  listMonitoring,
  getOne,
};
