const path = require('path');
const attendanceRequestService = require('../services/attendanceRequestService');

function contentTypeForAttachment(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return map[ext] || 'application/octet-stream';
}

function requireCompanyPortalUser(req, res, next) {
  if (req.user?.userType === 'Company' && req.user?.isSuperAdmin !== true) {
    return next();
  }
  return res.status(403).json({ error: 'Company portal access required' });
}

async function createWorkLocation(req, res, next) {
  try {
    const row = await attendanceRequestService.createWorkLocation(req.userId, req.body || {});
    return res.status(201).json(row);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
}

async function createAbsence(req, res, next) {
  try {
    const file = req.file || null;
    const row = await attendanceRequestService.createAbsence(req.userId, {
      absenceStartDate: req.body?.absenceStartDate,
      absenceEndDate: req.body?.absenceEndDate,
      absenceReason: req.body?.absenceReason,
      employeeNote: req.body?.employeeNote,
      attachment: file
        ? { filename: file.filename, originalname: file.originalname }
        : null,
    });
    return res.status(201).json(row);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
}

async function listMine(req, res, next) {
  try {
    const rows = await attendanceRequestService.listMine(req.userId);
    return res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

async function listSupervisor(req, res, next) {
  try {
    const rows = await attendanceRequestService.listForSupervisor(req.userId);
    return res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

async function listHr(req, res, next) {
  try {
    const rows = await attendanceRequestService.listForHr();
    return res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

async function decide(req, res, next) {
  try {
    const { status, decisionNote } = req.body || {};
    const row = await attendanceRequestService.decide(req.params.id, req.userId, { status, decisionNote });
    return res.json(row);
  } catch (err) {
    if (err.statusCode === 403) return res.status(403).json({ error: err.message, code: err.code });
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    if (err.statusCode === 400) return res.status(400).json({ error: err.message, code: err.code });
    next(err);
  }
}

async function downloadAttachment(req, res, next) {
  try {
    const { absPath, fileName } = await attendanceRequestService.assertCanReadAttachment(req.params.id, req.userId);
    const safeName = String(fileName || 'attachment').replace(/[\r\n"]/g, '');
    res.setHeader('Content-Type', contentTypeForAttachment(safeName));
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`);
    res.sendFile(absPath, (err) => {
      if (err) next(err);
    });
  } catch (err) {
    if (err.statusCode === 403) return res.status(403).json({ error: err.message });
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
}

module.exports = {
  requireCompanyPortalUser,
  createWorkLocation,
  createAbsence,
  listMine,
  listSupervisor,
  listHr,
  decide,
  downloadAttachment,
};
