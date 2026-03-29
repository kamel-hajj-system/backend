const { prisma } = require('../../users/models');

/**
 * List shifts. Optional filter by isForEmployee (for employee dropdown).
 * Optional locationId: returns shifts with that location OR global shifts (locationId null).
 */
async function getShifts(options = {}) {
  const { isForEmployee, locationId } = options;
  const and = [];
  if (isForEmployee !== undefined) and.push({ isForEmployee });
  if (locationId) {
    and.push({ OR: [{ locationId: null }, { locationId }] });
  }
  const where = and.length > 0 ? { AND: and } : {};

  return prisma.shift.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      shiftLocation: { select: { id: true, name: true, locationAr: true } },
    },
  });
}

/**
 * Get one shift by id.
 */
async function getShiftById(id) {
  return prisma.shift.findUnique({
    where: { id },
    include: {
      shiftLocation: { select: { id: true, name: true, locationAr: true } },
    },
  });
}

/**
 * Create shift. startTime/endTime as Date or "HH:mm" string (interpreted as today's time).
 */
async function createShift(data) {
  const startTime = parseTime(data.startTime);
  const endTime = parseTime(data.endTime);
  let locationId = data.locationId || null;
  if (locationId) {
    const loc = await prisma.shift_Location.findUnique({ where: { id: locationId }, select: { id: true } });
    if (!loc) {
      const err = new Error('Invalid work location');
      err.code = 'INVALID_SHIFT_LOCATION';
      throw err;
    }
  } else {
    locationId = null;
  }
  return prisma.shift.create({
    data: {
      name: data.name.trim(),
      shiftAr: data.shiftAr ? data.shiftAr.trim() : null,
      startTime,
      endTime,
      isForEmployee: data.isForEmployee !== false,
      locationId,
    },
    include: {
      shiftLocation: { select: { id: true, name: true, locationAr: true } },
    },
  });
}

/**
 * Update shift.
 */
async function updateShift(id, data) {
  const updatePayload = {};
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.shiftAr !== undefined) {
    updatePayload.shiftAr = data.shiftAr === null ? null : data.shiftAr.trim();
  }
  if (data.startTime !== undefined) updatePayload.startTime = parseTime(data.startTime);
  if (data.endTime !== undefined) updatePayload.endTime = parseTime(data.endTime);
  if (data.isForEmployee !== undefined) updatePayload.isForEmployee = data.isForEmployee;
  if (data.locationId !== undefined) {
    if (data.locationId === null || data.locationId === '') {
      updatePayload.locationId = null;
    } else {
      const loc = await prisma.shift_Location.findUnique({
        where: { id: data.locationId },
        select: { id: true },
      });
      if (!loc) {
        const err = new Error('Invalid work location');
        err.code = 'INVALID_SHIFT_LOCATION';
        throw err;
      }
      updatePayload.locationId = data.locationId;
    }
  }

  return prisma.shift.update({
    where: { id },
    data: updatePayload,
    include: {
      shiftLocation: { select: { id: true, name: true, locationAr: true } },
    },
  });
}

/** Parse time: Date object or "HH:mm" / "HH:mm:ss" string -> Date (epoch day). */
function parseTime(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const [, h, m, s] = match;
      const d = new Date(0);
      d.setUTCHours(parseInt(h, 10), parseInt(m, 10), s ? parseInt(s, 10) : 0, 0);
      return d;
    }
  }
  throw new Error('Invalid time format; use HH:mm or HH:mm:ss');
}

module.exports = {
  getShifts,
  getShiftById,
  createShift,
  updateShift,
};
