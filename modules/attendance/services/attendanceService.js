const { DateTime } = require('luxon');
const { prisma } = require('../../users/models');

const SAUDI_ZONE = 'Asia/Riyadh';

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getZone(location) {
  if (!location) return null;
  const { zoneCenterLat, zoneCenterLng, zoneRadiusMeters } = location;
  if (
    typeof zoneCenterLat !== 'number' ||
    typeof zoneCenterLng !== 'number' ||
    typeof zoneRadiusMeters !== 'number'
  ) {
    return null;
  }
  return {
    type: 'CIRCLE',
    centerLat: zoneCenterLat,
    centerLng: zoneCenterLng,
    radiusMeters: zoneRadiusMeters,
  };
}

function isInsideZone(zone, lat, lng) {
  if (!zone) return null;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const d = haversineMeters(lat, lng, zone.centerLat, zone.centerLng);
  return d <= zone.radiusMeters;
}

function timePartsFromPrismaTime(timeDate) {
  // Postgres TIME has no timezone. Prisma surfaces it as a Date.
  // Treat it as a pure clock-time by reading the UTC fields.
  // (This matches how we display Shift times elsewhere in the app.)
  return {
    hour: timeDate.getUTCHours(),
    minute: timeDate.getUTCMinutes(),
    second: timeDate.getUTCSeconds(),
  };
}

function computeShiftInstance(now, shift) {
  const startParts = timePartsFromPrismaTime(shift.startTime);
  const endParts = timePartsFromPrismaTime(shift.endTime);

  const today = now.setZone(SAUDI_ZONE).startOf('day');
  const yesterday = today.minus({ days: 1 });
  const tomorrow = today.plus({ days: 1 });

  const candidates = [yesterday, today, tomorrow].map((day) => {
    const start = DateTime.fromObject(
      { year: day.year, month: day.month, day: day.day, ...startParts },
      { zone: SAUDI_ZONE }
    );
    let end = DateTime.fromObject(
      { year: day.year, month: day.month, day: day.day, ...endParts },
      { zone: SAUDI_ZONE }
    );
    if (end <= start) end = end.plus({ days: 1 }); // crosses midnight

    const checkInEarliestAt = start.minus({ hours: 1 });
    const checkInLatestAt = end; // can check in until shift end
    const checkOutLatestAt = end.plus({ hours: 1 });
    return { start, end, checkInEarliestAt, checkInLatestAt, checkOutLatestAt };
  });

  // 1) If we're within the "active window" (start-1h .. end+1h), that's the current shift instance.
  const current = candidates.find((c) => now >= c.checkInEarliestAt && now <= c.checkOutLatestAt);
  if (current) {
    return {
      mode: 'current',
      shiftStartAt: current.start,
      shiftEndAt: current.end,
      checkInEarliestAt: current.checkInEarliestAt,
      checkInLatestAt: current.checkInLatestAt,
      checkOutLatestAt: current.checkOutLatestAt,
    };
  }

  // 2) Otherwise, show the next upcoming shift instance (prevents showing "yesterday" when shift is over).
  const upcoming = candidates
    .filter((c) => c.checkInEarliestAt > now)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis())[0];

  const picked = upcoming ?? candidates.sort((a, b) => a.start.toMillis() - b.start.toMillis())[0];
  return {
    mode: 'upcoming',
    shiftStartAt: picked.start,
    shiftEndAt: picked.end,
    checkInEarliestAt: picked.checkInEarliestAt,
    checkInLatestAt: picked.checkInLatestAt,
    checkOutLatestAt: picked.checkOutLatestAt,
  };
}

async function getShiftAwareStatus(userId, geo = null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      shiftId: true,
      locationId: true,
      shift: { select: { id: true, name: true, shiftAr: true, startTime: true, endTime: true } },
      shiftLocation: { select: { id: true, name: true, locationAr: true, zoneCenterLat: true, zoneCenterLng: true, zoneRadiusMeters: true } },
    },
  });
  if (!user) return { status: 'NO_USER' };
  if (!user.shiftId || !user.shift) return { status: 'NO_SHIFT' };

  const now = DateTime.now().setZone(SAUDI_ZONE);
  const window = computeShiftInstance(now, user.shift);

  const record = await prisma.attendanceRecord.findUnique({
    where: { userId_shiftStartAt: { userId, shiftStartAt: window.shiftStartAt.toJSDate() } },
  });

  const zone = getZone(user.shiftLocation);
  const inside = geo ? isInsideZone(zone, geo.lat, geo.lng) : null;

  return {
    status: 'OK',
    now: now.toISO(),
    zone: SAUDI_ZONE,
    location: user.shiftLocation
      ? {
          id: user.shiftLocation.id,
          name: user.shiftLocation.name,
          locationAr: user.shiftLocation.locationAr,
          zone: zone ? { ...zone } : null,
        }
      : null,
    geo: geo
      ? {
          lat: geo.lat,
          lng: geo.lng,
          accuracyMeters: geo.accuracyMeters ?? null,
          isInsideZone: inside,
        }
      : null,
    shift: {
      id: user.shift.id,
      name: user.shift.name,
      shiftAr: user.shift.shiftAr,
      mode: window.mode,
      shiftStartAt: window.shiftStartAt.toISO(),
      shiftEndAt: window.shiftEndAt.toISO(),
      checkInEarliestAt: window.checkInEarliestAt.toISO(),
      checkInLatestAt: window.checkInLatestAt.toISO(),
      checkOutLatestAt: window.checkOutLatestAt.toISO(),
    },
    record: record
      ? {
          id: record.id,
          checkInAt: record.checkInAt ? DateTime.fromJSDate(record.checkInAt).setZone(SAUDI_ZONE).toISO() : null,
          checkOutAt: record.checkOutAt ? DateTime.fromJSDate(record.checkOutAt).setZone(SAUDI_ZONE).toISO() : null,
          shiftStartAt: DateTime.fromJSDate(record.shiftStartAt).setZone(SAUDI_ZONE).toISO(),
          shiftEndAt: DateTime.fromJSDate(record.shiftEndAt).setZone(SAUDI_ZONE).toISO(),
        }
      : null,
  };
}

async function checkIn(userId, geo) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      shiftId: true,
      locationId: true,
      shift: { select: { id: true, name: true, shiftAr: true, startTime: true, endTime: true } },
      shiftLocation: { select: { id: true, zoneCenterLat: true, zoneCenterLng: true, zoneRadiusMeters: true } },
    },
  });
  if (!user) {
    const err = new Error('User not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!user.shiftId || !user.shift) {
    const err = new Error('User has no shift assigned');
    err.code = 'NO_SHIFT';
    throw err;
  }

  const now = DateTime.now().setZone(SAUDI_ZONE);
  const window = computeShiftInstance(now, user.shift);

  if (now < window.checkInEarliestAt) {
    const err = new Error('Too early to check in');
    err.code = 'TOO_EARLY';
    throw err;
  }
  if (now > window.checkInLatestAt) {
    const err = new Error('Too late to check in');
    err.code = 'TOO_LATE';
    throw err;
  }

  // Mobile-only mode: require device geo for attendance.
  if (!geo || typeof geo.lat !== 'number' || typeof geo.lng !== 'number') {
    const err = new Error('Location is required to check in');
    err.code = 'GEO_REQUIRED';
    throw err;
  }

  const zone = getZone(user.shiftLocation);
  if (zone) {
    const inside = isInsideZone(zone, geo.lat, geo.lng);
    if (inside !== true) {
      const err = new Error('You are outside the allowed zone');
      err.code = 'OUTSIDE_ZONE';
      throw err;
    }
  }

  const key = { userId_shiftStartAt: { userId, shiftStartAt: window.shiftStartAt.toJSDate() } };
  const existing = await prisma.attendanceRecord.findUnique({ where: key });
  if (existing?.checkInAt) {
    const err = new Error('Already checked in');
    err.code = 'ALREADY_CHECKED_IN';
    throw err;
  }

  const insideAtCheckIn = geo ? isInsideZone(zone, geo.lat, geo.lng) : null;

  const record = existing
    ? await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          checkInAt: now.toJSDate(),
          checkInLat: geo?.lat ?? null,
          checkInLng: geo?.lng ?? null,
          checkInAccuracyMeters: geo?.accuracyMeters ?? null,
          checkInInsideZone: insideAtCheckIn,
        },
      })
    : await prisma.attendanceRecord.create({
        data: {
          userId,
          shiftId: user.shift.id,
          shiftStartAt: window.shiftStartAt.toJSDate(),
          shiftEndAt: window.shiftEndAt.toJSDate(),
          checkInAt: now.toJSDate(),
          checkInLat: geo?.lat ?? null,
          checkInLng: geo?.lng ?? null,
          checkInAccuracyMeters: geo?.accuracyMeters ?? null,
          checkInInsideZone: insideAtCheckIn,
        },
      });

  return { recordId: record.id };
}

async function checkOut(userId, geo) {
  const now = DateTime.now().setZone(SAUDI_ZONE);

  // Find latest open record for this user.
  const open = await prisma.attendanceRecord.findFirst({
    where: { userId, checkInAt: { not: null }, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
  });

  if (!open) {
    const err = new Error('No active check-in found');
    err.code = 'NO_ACTIVE_CHECKIN';
    throw err;
  }

  const shiftEnd = DateTime.fromJSDate(open.shiftEndAt).setZone(SAUDI_ZONE);
  const latestOut = shiftEnd.plus({ hours: 1 });
  if (now > latestOut) {
    const err = new Error('Checkout window expired');
    err.code = 'CHECKOUT_EXPIRED';
    throw err;
  }

  // Mobile-only mode: require device geo for attendance.
  if (!geo || typeof geo.lat !== 'number' || typeof geo.lng !== 'number') {
    const err = new Error('Location is required to check out');
    err.code = 'GEO_REQUIRED';
    throw err;
  }

  // Enforce zone at checkout if the location has a zone.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { shiftLocation: { select: { zoneCenterLat: true, zoneCenterLng: true, zoneRadiusMeters: true } } },
  });
  const zone = getZone(user?.shiftLocation);
  if (zone) {
    const inside = isInsideZone(zone, geo.lat, geo.lng);
    if (inside !== true) {
      const err = new Error('You are outside the allowed zone');
      err.code = 'OUTSIDE_ZONE';
      throw err;
    }
  }

  const insideAtCheckOut = geo ? isInsideZone(zone, geo.lat, geo.lng) : null;

  const updated = await prisma.attendanceRecord.update({
    where: { id: open.id },
    data: {
      checkOutAt: now.toJSDate(),
      checkOutLat: geo?.lat ?? null,
      checkOutLng: geo?.lng ?? null,
      checkOutAccuracyMeters: geo?.accuracyMeters ?? null,
      checkOutInsideZone: insideAtCheckOut,
    },
  });

  return { recordId: updated.id };
}

function riyadhDayStart(dateStr) {
  // Expect YYYY-MM-DD or any ISO date; take the date part in Riyadh.
  const dt = DateTime.fromISO(String(dateStr), { zone: SAUDI_ZONE });
  if (!dt.isValid) return null;
  return dt.startOf('day');
}

async function listHrAttendance(options = {}) {
  const {
    page = 1,
    limit = 50,
    dateFrom,
    dateTo,
    shiftId,
    locationId,
    q,
    hasCheckIn,
    hasCheckOut,
  } = options;

  const where = {
    user: {
      isDeleted: false,
      isSuperAdmin: false,
    },
  };

  if (shiftId) where.shiftId = shiftId;
  if (locationId) where.user.locationId = locationId;
  if (typeof hasCheckIn === 'boolean') {
    where.checkInAt = hasCheckIn ? { not: null } : null;
  }
  if (typeof hasCheckOut === 'boolean') {
    where.checkOutAt = hasCheckOut ? { not: null } : null;
  }
  if (q && String(q).trim() !== '') {
    const term = String(q).trim();
    where.user.OR = [
      { fullName: { contains: term, mode: 'insensitive' } },
      { fullNameAr: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } },
    ];
  }

  // Date filter based on shiftStartAt in Riyadh day boundaries.
  const start = dateFrom ? riyadhDayStart(dateFrom) : null;
  const end = dateTo ? riyadhDayStart(dateTo)?.plus({ days: 1 }) : null;
  if (start && end) {
    where.shiftStartAt = { gte: start.toJSDate(), lt: end.toJSDate() };
  } else if (start) {
    where.shiftStartAt = { gte: start.toJSDate(), lt: start.plus({ days: 1 }).toJSDate() };
  }

  const [rows, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      orderBy: { shiftStartAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        shiftStartAt: true,
        shiftEndAt: true,
        checkInAt: true,
        checkOutAt: true,
        checkInLat: true,
        checkInLng: true,
        checkInAccuracyMeters: true,
        checkInInsideZone: true,
        checkOutLat: true,
        checkOutLng: true,
        checkOutAccuracyMeters: true,
        checkOutInsideZone: true,
        shift: { select: { id: true, name: true, shiftAr: true } },
        user: {
          select: {
            id: true,
            fullName: true,
            fullNameAr: true,
            email: true,
            phone: true,
            role: true,
            userType: true,
            locationId: true,
            shiftLocation: { select: { id: true, name: true, locationAr: true } },
          },
        },
      },
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return { data: rows, total, page, limit };
}

module.exports = {
  SAUDI_ZONE,
  getShiftAwareStatus,
  checkIn,
  checkOut,
  listHrAttendance,
};

