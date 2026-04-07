const { prisma } = require('../users/models');

const userNameSelect = { fullName: true, fullNameAr: true, email: true };

function displayName(u) {
  if (!u) return null;
  return u.fullNameAr || u.fullName || u.email || null;
}

function serialize(r) {
  return {
    id: r.id,
    locationId: r.locationId,
    status: r.status,
    companyName: r.companyName,
    busNumber: r.busNumber,
    pilgrimCountOnBus: r.pilgrimCountOnBus,
    nationality: r.nationality,
    moveFrom: r.moveFrom,
    moveTo: r.moveTo,
    moveTime: r.moveTime,
    airportSupervisorUserId: r.airportSupervisorUserId,
    airportSupervisorApprovedAt: r.airportSupervisorApprovedAt ? r.airportSupervisorApprovedAt.toISOString() : null,
    airportSupervisorName: displayName(r.airportSupervisor),
    hospitalityCenter: r.hospitalityCenter,
    housingName: r.housingName,
    passportCount: r.passportCount,
    driverName: r.driverName,
    guideName: r.guideName,
    guidePhone: r.guidePhone,
    adminSupervisorUserId: r.adminSupervisorUserId,
    adminCompletedAt: r.adminCompletedAt ? r.adminCompletedAt.toISOString() : null,
    adminSupervisorName: displayName(r.adminSupervisor),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    createdById: r.createdById,
    editorName: displayName(r.createdBy),
  };
}

const includeUsers = {
  createdBy: { select: userNameSelect },
  airportSupervisor: { select: userNameSelect },
  adminSupervisor: { select: userNameSelect },
};

async function summaryForLocation(locationId) {
  const grouped = await prisma.busMovementReport.groupBy({
    by: ['status'],
    where: { locationId },
    _count: { _all: true },
  });
  const out = {
    PENDING_SUPERVISOR: 0,
    APPROVED_AIRPORT: 0,
    COMPLETED_ADMIN: 0,
    total: 0,
  };
  for (const row of grouped) {
    out[row.status] = row._count._all;
    out.total += row._count._all;
  }
  return out;
}

async function listAirport({ locationId, userId, isSupervisor }) {
  const where = isSupervisor
    ? { locationId }
    : { locationId, createdById: userId };

  const rows = await prisma.busMovementReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: includeUsers,
  });
  return rows.map(serialize);
}

async function listAdmin({ locationId }) {
  const rows = await prisma.busMovementReport.findMany({
    where: {
      locationId,
      status: { in: ['APPROVED_AIRPORT', 'COMPLETED_ADMIN'] },
    },
    orderBy: { createdAt: 'desc' },
    include: includeUsers,
  });
  return rows.map(serialize);
}

async function getByIdForLocation(id, locationId) {
  const r = await prisma.busMovementReport.findFirst({
    where: { id, locationId },
    include: includeUsers,
  });
  return r ? serialize(r) : null;
}

async function createReport({ locationId, createdById, body }) {
  const r = await prisma.busMovementReport.create({
    data: {
      locationId,
      createdById,
      companyName: String(body.companyName || '').trim().slice(0, 500),
      busNumber: String(body.busNumber || '').trim().slice(0, 120),
      pilgrimCountOnBus: Math.max(0, parseInt(body.pilgrimCountOnBus, 10) || 0),
      nationality: String(body.nationality || '').trim().slice(0, 200),
      moveFrom: String(body.moveFrom || '').trim(),
      moveTo: String(body.moveTo || '').trim(),
      moveTime: String(body.moveTime || '').trim().slice(0, 120),
      status: 'PENDING_SUPERVISOR',
    },
    include: includeUsers,
  });
  return serialize(r);
}

async function supervisorApprove({ id, locationId, supervisorUserId, body }) {
  const existing = await prisma.busMovementReport.findFirst({
    where: { id, locationId },
  });
  if (!existing) return { error: 'NOT_FOUND' };
  if (existing.status !== 'PENDING_SUPERVISOR') {
    return { error: 'INVALID_STATUS' };
  }

  const patch = {
    status: 'APPROVED_AIRPORT',
    airportSupervisorUserId: supervisorUserId,
    airportSupervisorApprovedAt: new Date(),
  };
  const fields = [
    'companyName',
    'busNumber',
    'pilgrimCountOnBus',
    'nationality',
    'moveFrom',
    'moveTo',
    'moveTime',
  ];
  for (const f of fields) {
    if (body[f] === undefined) continue;
    if (f === 'pilgrimCountOnBus') {
      patch.pilgrimCountOnBus = Math.max(0, parseInt(body.pilgrimCountOnBus, 10) || 0);
    } else if (f === 'companyName') {
      patch.companyName = String(body.companyName || '').trim().slice(0, 500);
    } else if (f === 'busNumber') {
      patch.busNumber = String(body.busNumber || '').trim().slice(0, 120);
    } else if (f === 'nationality') {
      patch.nationality = String(body.nationality || '').trim().slice(0, 200);
    } else if (f === 'moveFrom') {
      patch.moveFrom = String(body.moveFrom || '').trim();
    } else if (f === 'moveTo') {
      patch.moveTo = String(body.moveTo || '').trim();
    } else if (f === 'moveTime') {
      patch.moveTime = String(body.moveTime || '').trim().slice(0, 120);
    }
  }

  const r = await prisma.busMovementReport.update({
    where: { id },
    data: patch,
    include: includeUsers,
  });
  return { ok: true, report: serialize(r) };
}

async function adminUpdate({ id, locationId, adminUserId, body }) {
  const existing = await prisma.busMovementReport.findFirst({
    where: { id, locationId },
  });
  if (!existing) return { error: 'NOT_FOUND' };
  if (existing.status !== 'APPROVED_AIRPORT' && existing.status !== 'COMPLETED_ADMIN') {
    return { error: 'INVALID_STATUS' };
  }

  const data = {
    adminSupervisorUserId: adminUserId,
    adminCompletedAt: new Date(),
    status: 'COMPLETED_ADMIN',
  };
  if (body.hospitalityCenter !== undefined) {
    data.hospitalityCenter = body.hospitalityCenter ? String(body.hospitalityCenter).trim().slice(0, 500) : null;
  }
  if (body.housingName !== undefined) {
    data.housingName = body.housingName ? String(body.housingName).trim().slice(0, 500) : null;
  }
  if (body.passportCount !== undefined) {
    data.passportCount = body.passportCount === null || body.passportCount === ''
      ? null
      : Math.max(0, parseInt(body.passportCount, 10) || 0);
  }
  if (body.driverName !== undefined) {
    data.driverName = body.driverName ? String(body.driverName).trim().slice(0, 200) : null;
  }
  if (body.guideName !== undefined) {
    data.guideName = body.guideName ? String(body.guideName).trim().slice(0, 200) : null;
  }
  if (body.guidePhone !== undefined) {
    data.guidePhone = body.guidePhone ? String(body.guidePhone).trim().slice(0, 50) : null;
  }
  if (body.companyName !== undefined) {
    data.companyName = String(body.companyName || '').trim().slice(0, 500);
  }
  if (body.busNumber !== undefined) {
    data.busNumber = String(body.busNumber || '').trim().slice(0, 120);
  }
  if (body.nationality !== undefined) {
    data.nationality = String(body.nationality || '').trim().slice(0, 200);
  }
  if (body.pilgrimCountOnBus !== undefined) {
    data.pilgrimCountOnBus = Math.max(0, parseInt(body.pilgrimCountOnBus, 10) || 0);
  }

  const r = await prisma.busMovementReport.update({
    where: { id },
    data,
    include: includeUsers,
  });
  return { ok: true, report: serialize(r) };
}

module.exports = {
  summaryForLocation,
  listAirport,
  listAdmin,
  getByIdForLocation,
  createReport,
  supervisorApprove,
  adminUpdate,
};
