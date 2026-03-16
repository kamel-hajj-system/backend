const { prisma } = require('../../users/models');

/**
 * List shifts. Optional filter by isForEmployee (for employee dropdown).
 */
async function getShifts(options = {}) {
  const { isForEmployee } = options;
  const where = {};
  if (isForEmployee !== undefined) where.isForEmployee = isForEmployee;

  return prisma.shift.findMany({
    where,
    orderBy: { name: 'asc' },
  });
}

/**
 * Get one shift by id.
 */
async function getShiftById(id) {
  return prisma.shift.findUnique({
    where: { id },
  });
}

/**
 * Create shift. startTime/endTime as Date or "HH:mm" string (interpreted as today's time).
 */
async function createShift(data) {
  const startTime = parseTime(data.startTime);
  const endTime = parseTime(data.endTime);
  return prisma.shift.create({
    data: {
      name: data.name.trim(),
      shiftAr: data.shiftAr ? data.shiftAr.trim() : null,
      startTime,
      endTime,
      isForEmployee: data.isForEmployee !== false,
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

  return prisma.shift.update({
    where: { id },
    data: updatePayload,
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
