const path = require('path');
const fs = require('fs');
const { prisma } = require('../../users/models');
const userService = require('../../users/services/userService');

const UPLOAD_DIR = path.join(__dirname, '../../../uploads/attendance-requests');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function serializeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    fullName: u.fullName,
    fullNameAr: u.fullNameAr,
    email: u.email,
    locationId: u.locationId ?? null,
    shiftId: u.shiftId ?? null,
  };
}

function serializeRequest(row) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    workLocationMode: row.workLocationMode,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    absenceStartDate: row.absenceStartDate,
    absenceEndDate: row.absenceEndDate,
    absenceReason: row.absenceReason,
    hasAttachment: Boolean(row.attachmentStoredName),
    attachmentFileName: row.attachmentFileName,
    employeeNote: row.employeeNote,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    requester: serializeUser(row.requester),
    decidedBy: serializeUser(row.decidedBy),
  };
}

const requesterInclude = {
  select: { id: true, fullName: true, fullNameAr: true, email: true, supervisorId: true, locationId: true, shiftId: true },
};
const deciderInclude = { select: { id: true, fullName: true, fullNameAr: true, email: true } };

async function createWorkLocation(requesterId, body) {
  const mode = body.workLocationMode;
  if (mode !== 'ONLINE' && mode !== 'HOME') {
    const err = new Error('workLocationMode must be ONLINE or HOME');
    err.statusCode = 400;
    throw err;
  }
  let effectiveFrom = null;
  let effectiveTo = null;
  if (body.effectiveFrom) {
    const d = new Date(body.effectiveFrom);
    if (Number.isNaN(d.getTime())) {
      const err = new Error('effectiveFrom must be a valid date');
      err.statusCode = 400;
      throw err;
    }
    effectiveFrom = d;
  }
  if (body.effectiveTo) {
    const d2 = new Date(body.effectiveTo);
    if (Number.isNaN(d2.getTime())) {
      const err = new Error('effectiveTo must be a valid date');
      err.statusCode = 400;
      throw err;
    }
    effectiveTo = d2;
  }
  if (!effectiveFrom) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    effectiveFrom = today;
  }
  if (!effectiveTo) {
    effectiveTo = effectiveFrom;
  }
  if (effectiveFrom.getTime() > effectiveTo.getTime()) {
    const err = new Error('effectiveFrom must be on or before effectiveTo');
    err.statusCode = 400;
    throw err;
  }

  const row = await prisma.attendanceRequest.create({
    data: {
      requesterId,
      kind: 'WORK_LOCATION',
      status: 'PENDING',
      workLocationMode: mode,
      effectiveFrom,
      effectiveTo,
      employeeNote: body.employeeNote != null ? String(body.employeeNote).trim() || null : null,
    },
    include: { requester: requesterInclude, decidedBy: deciderInclude },
  });
  return serializeRequest(row);
}

async function createAbsence(requesterId, { absenceStartDate, absenceEndDate, absenceReason, employeeNote, attachment }) {
  if (!absenceStartDate || !absenceEndDate) {
    const err = new Error('absenceStartDate and absenceEndDate are required');
    err.statusCode = 400;
    throw err;
  }
  const start = new Date(absenceStartDate);
  const end = new Date(absenceEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const err = new Error('Invalid absence dates');
    err.statusCode = 400;
    throw err;
  }
  if (start > end) {
    const err = new Error('absenceStartDate must be on or before absenceEndDate');
    err.statusCode = 400;
    throw err;
  }

  let attachmentFileName = null;
  let attachmentStoredName = null;
  if (attachment && attachment.filename) {
    ensureUploadDir();
    attachmentStoredName = attachment.filename;
    attachmentFileName = attachment.originalname || attachment.filename;
  }

  const row = await prisma.attendanceRequest.create({
    data: {
      requesterId,
      kind: 'ABSENCE',
      status: 'PENDING',
      absenceStartDate: start,
      absenceEndDate: end,
      absenceReason: absenceReason != null ? String(absenceReason).trim() || null : null,
      employeeNote: employeeNote != null ? String(employeeNote).trim() || null : null,
      attachmentFileName,
      attachmentStoredName,
    },
    include: { requester: requesterInclude, decidedBy: deciderInclude },
  });
  return serializeRequest(row);
}

async function listMine(requesterId) {
  const rows = await prisma.attendanceRequest.findMany({
    where: { requesterId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { requester: requesterInclude, decidedBy: deciderInclude },
  });
  return rows.map(serializeRequest);
}

async function listForSupervisor(supervisorId) {
  const teamIds = await userService.getCompanyTeamUserIds(supervisorId);
  if (teamIds.length === 0) return [];
  const rows = await prisma.attendanceRequest.findMany({
    where: { requesterId: { in: teamIds } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { requester: requesterInclude, decidedBy: deciderInclude },
  });
  return rows.map(serializeRequest);
}

async function listForHr() {
  const rows = await prisma.attendanceRequest.findMany({
    where: {
      requester: { userType: 'Company', isDeleted: false },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { requester: requesterInclude, decidedBy: deciderInclude },
  });
  return rows.map(serializeRequest);
}

async function decide(requestId, deciderId, { status, decisionNote }) {
  if (status !== 'APPROVED' && status !== 'REJECTED') {
    const err = new Error('status must be APPROVED or REJECTED');
    err.statusCode = 400;
    throw err;
  }

  const existing = await prisma.attendanceRequest.findUnique({
    where: { id: requestId },
    include: { requester: { select: { id: true, supervisorId: true } } },
  });
  if (!existing) {
    const err = new Error('Request not found');
    err.statusCode = 404;
    throw err;
  }
  if (existing.status !== 'PENDING') {
    const err = new Error('Request is no longer pending');
    err.statusCode = 400;
    throw err;
  }

  const decider = await prisma.user.findFirst({
    where: { id: deciderId, isDeleted: false },
    select: { id: true, userType: true, isHr: true },
  });
  if (!decider) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const isDirectSupervisor = existing.requester.supervisorId === deciderId;
  const isCompanyHr = decider.userType === 'Company' && decider.isHr === true;
  if (!isDirectSupervisor && !isCompanyHr) {
    const err = new Error('Only the employee\'s direct supervisor or HR can approve or reject');
    err.statusCode = 403;
    err.code = 'NOT_AUTHORIZED_DECIDER';
    throw err;
  }

  const updated = await prisma.attendanceRequest.update({
    where: { id: requestId },
    data: {
      status,
      decidedById: deciderId,
      decidedAt: new Date(),
      decisionNote: decisionNote != null ? String(decisionNote).trim() || null : null,
    },
    include: { requester: requesterInclude, decidedBy: deciderInclude },
  });
  return serializeRequest(updated);
}

async function assertCanReadAttachment(requestId, userId) {
  const row = await prisma.attendanceRequest.findUnique({
    where: { id: requestId },
    include: { requester: { select: { id: true, supervisorId: true } } },
  });
  if (!row || !row.attachmentStoredName) {
    const err = new Error('Attachment not found');
    err.statusCode = 404;
    throw err;
  }
  const u = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    select: { id: true, isHr: true, userType: true },
  });
  if (!u) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const isRequester = row.requesterId === userId;
  const isSupervisor = row.requester.supervisorId === userId;
  const isHr = u.userType === 'Company' && u.isHr === true;
  /** Same scope as supervisor attendance list: direct reports ∪ delegated visibility. */
  let isTeamViewer = false;
  if (u.userType === 'Company' && !isRequester && !isSupervisor && !isHr) {
    const teamIds = await userService.getCompanyTeamUserIds(userId);
    isTeamViewer = teamIds.includes(row.requesterId);
  }
  if (!isRequester && !isSupervisor && !isHr && !isTeamViewer) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const absPath = path.join(UPLOAD_DIR, row.attachmentStoredName);
  if (!fs.existsSync(absPath)) {
    const err = new Error('Attachment file missing on server');
    err.statusCode = 404;
    throw err;
  }
  return {
    absPath,
    fileName: row.attachmentFileName || 'attachment',
  };
}

module.exports = {
  UPLOAD_DIR,
  ensureUploadDir,
  createWorkLocation,
  createAbsence,
  listMine,
  listForSupervisor,
  listForHr,
  decide,
  assertCanReadAttachment,
};
