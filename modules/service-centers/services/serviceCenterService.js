const { prisma } = require('../../users/models');
const pilgrimNationalityService = require('./pilgrimNationalityService');

const USER_LIST_SELECT = {
  id: true,
  fullName: true,
  fullNameAr: true,
  email: true,
  phone: true,
  userType: true,
  role: true,
  serviceCenterId: true,
  isActive: true,
  createdAt: true,
};

const centerInclude = {
  nationalities: {
    include: { nationality: true },
    orderBy: { createdAt: 'asc' },
  },
};

function autoCenterDisplayNames(code) {
  const c = String(code || '').trim();
  return {
    name: `Service Center ${c}`,
    nameAr: `مركز الخدمة ${c}`,
  };
}

/** Sum of pilgrimsCount across nationality rows for one center. */
function sumAllocatedFromRows(rows) {
  return (rows || []).reduce((s, n) => s + (Number.isFinite(n.pilgrimsCount) ? n.pilgrimsCount : 0), 0);
}

/**
 * When maxCapacity is set, total allocated pilgrims (all nationality rows) cannot exceed it.
 * @param {number|null|undefined} maxCapacity
 * @param {number} allocatedSum
 */
function assertAllocatedWithinMaxCapacity(maxCapacity, allocatedSum) {
  if (maxCapacity == null) return;
  const cap = Number(maxCapacity);
  if (!Number.isFinite(cap) || cap < 0) return;
  if (allocatedSum > cap) {
    const err = new Error(
      `Total pilgrims assigned across nationalities (${allocatedSum}) exceeds this center's maximum capacity (${cap}). Reduce the allocations or increase max capacity.`
    );
    err.code = 'CAPACITY_EXCEEDED';
    err.details = { allocatedSum, maxCapacity: cap };
    throw err;
  }
}

async function attachUserCounts(centers) {
  if (!centers.length) return centers;
  const ids = centers.map((c) => c.id);
  const grouped = await prisma.user.groupBy({
    by: ['serviceCenterId'],
    where: {
      isDeleted: false,
      serviceCenterId: { in: ids },
    },
    _count: { _all: true },
  });
  const map = Object.fromEntries(
    grouped.filter((g) => g.serviceCenterId).map((g) => [g.serviceCenterId, g._count._all])
  );
  return centers.map((c) => ({
    ...c,
    userCount: map[c.id] ?? 0,
  }));
}

/** Public signup: minimal fields, no auth. */
async function listPublicCatalog() {
  return prisma.serviceCenter.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      nameAr: true,
    },
    orderBy: { code: 'asc' },
  });
}

async function list() {
  const centers = await prisma.serviceCenter.findMany({
    orderBy: [{ code: 'asc' }, { createdAt: 'desc' }],
    include: centerInclude,
  });
  return attachUserCounts(centers);
}

async function getById(id) {
  const c = await prisma.serviceCenter.findUnique({
    where: { id },
    include: centerInclude,
  });
  if (!c) return null;
  const [withCount] = await attachUserCounts([c]);
  return withCount;
}

function normalizeNationalityRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && r.pilgrimNationalityId)
    .map((r) => ({
      pilgrimNationalityId: r.pilgrimNationalityId,
      pilgrimsCount: Number.isFinite(r.pilgrimsCount) ? r.pilgrimsCount : 0,
      arrivingPilgrimsCount: Number.isFinite(r.arrivingPilgrimsCount) ? r.arrivingPilgrimsCount : 0,
    }));
}

/**
 * @param {string|null} serviceCenterId  null when creating a new center
 * @param {ReturnType<typeof normalizeNationalityRows>} rows
 */
async function assertCenterNationalityBusinessRules(serviceCenterId, rows) {
  const normalized = normalizeNationalityRows(rows);
  const seen = new Set();
  for (const row of normalized) {
    if (seen.has(row.pilgrimNationalityId)) {
      const err = new Error('Each nationality can only appear once per service center.');
      err.code = 'DUPLICATE_NATIONALITY_IN_CENTER';
      throw err;
    }
    seen.add(row.pilgrimNationalityId);
    if (row.arrivingPilgrimsCount > row.pilgrimsCount) {
      const err = new Error(
        'Arriving pilgrims cannot be greater than allocated pilgrims for the same nationality row.'
      );
      err.code = 'ARRIVING_EXCEEDS_ALLOCATED_ROW';
      err.details = {
        pilgrimNationalityId: row.pilgrimNationalityId,
        pilgrimsCount: row.pilgrimsCount,
        arrivingPilgrimsCount: row.arrivingPilgrimsCount,
      };
      throw err;
    }
  }
  if (!normalized.length) return;

  const metaRows = await prisma.pilgrimNationality.findMany({
    where: { id: { in: [...seen] } },
    select: { id: true, name: true, totalPilgrimsCount: true },
  });
  const metaMap = Object.fromEntries(metaRows.map((m) => [m.id, m]));

  for (const row of normalized) {
    const meta = metaMap[row.pilgrimNationalityId];
    const total = meta?.totalPilgrimsCount;
    if (total == null || !Number.isFinite(Number(total))) continue;
    const cap = Number(total);
    const where = { pilgrimNationalityId: row.pilgrimNationalityId };
    if (serviceCenterId) {
      where.serviceCenterId = { not: serviceCenterId };
    }
    const { _sum } = await prisma.serviceCenterNationality.aggregate({
      where,
      _sum: { pilgrimsCount: true },
    });
    const allocatedAtOtherCenters = _sum.pilgrimsCount ?? 0;
    if (allocatedAtOtherCenters + row.pilgrimsCount > cap) {
      const err = new Error(
        `For nationality "${meta.name}", other centers already have ${allocatedAtOtherCenters} pilgrims allocated; this row adds ${row.pilgrimsCount}, but the national total is ${cap}. Reduce allocations or raise the nationality total.`
      );
      err.code = 'NATIONALITY_ALLOCATION_EXCEEDED';
      err.details = {
        nationalityId: row.pilgrimNationalityId,
        nationalityName: meta.name,
        nationalTotal: cap,
        allocatedAtOtherCenters,
        requestedForThisCenter: row.pilgrimsCount,
      };
      throw err;
    }
  }
}

async function create(data) {
  const code = data.code != null ? String(data.code).trim() : '';
  if (!code) {
    const err = new Error('Center code is required (e.g. 110)');
    err.code = 'CODE_REQUIRED';
    throw err;
  }

  const nationalities = normalizeNationalityRows(data.nationalities);
  if (nationalities.length) {
    const ids = [...new Set(nationalities.map((n) => n.pilgrimNationalityId))];
    const found = await prisma.pilgrimNationality.count({ where: { id: { in: ids } } });
    if (found !== ids.length) {
      const err = new Error('One or more pilgrim nationality ids are invalid');
      err.code = 'INVALID_NATIONALITY';
      throw err;
    }
  }

  const maxCap = data.maxCapacity !== undefined && data.maxCapacity !== null ? data.maxCapacity : null;
  assertAllocatedWithinMaxCapacity(maxCap, sumAllocatedFromRows(nationalities));
  await assertCenterNationalityBusinessRules(null, nationalities);

  const { name: autoName, nameAr: autoNameAr } = autoCenterDisplayNames(code);

  const created = await prisma.serviceCenter.create({
    data: {
      code,
      name: autoName,
      nameAr: autoNameAr,
      presidentName: data.presidentName?.trim() || null,
      vicePresidentName: data.vicePresidentName?.trim() || null,
      maxCapacity: data.maxCapacity ?? null,
      nationalities:
        nationalities.length > 0
          ? {
              create: nationalities.map((n) => ({
                pilgrimNationalityId: n.pilgrimNationalityId,
                pilgrimsCount: n.pilgrimsCount,
                arrivingPilgrimsCount: n.arrivingPilgrimsCount,
              })),
            }
          : undefined,
    },
    include: centerInclude,
  });

  if (nationalities.length) {
    await pilgrimNationalityService.syncArrivingTotalsForNationalityIds(
      nationalities.map((n) => n.pilgrimNationalityId)
    );
  }

  return created;
}

async function update(id, data) {
  const existing = await prisma.serviceCenter.findUnique({ where: { id } });
  if (!existing) return null;

  const nationalities = data.nationalities !== undefined ? normalizeNationalityRows(data.nationalities) : undefined;
  if (nationalities && nationalities.length) {
    const ids = [...new Set(nationalities.map((n) => n.pilgrimNationalityId))];
    const found = await prisma.pilgrimNationality.count({ where: { id: { in: ids } } });
    if (found !== ids.length) {
      const err = new Error('One or more pilgrim nationality ids are invalid');
      err.code = 'INVALID_NATIONALITY';
      throw err;
    }
  }

  let nationalityIdsToSyncAfterUpdate = [];
  if (nationalities !== undefined) {
    const previousLinks = await prisma.serviceCenterNationality.findMany({
      where: { serviceCenterId: id },
      select: { pilgrimNationalityId: true },
    });
    const previousIds = previousLinks.map((l) => l.pilgrimNationalityId);
    const nextIds = nationalities.map((n) => n.pilgrimNationalityId);
    nationalityIdsToSyncAfterUpdate = [...new Set([...previousIds, ...nextIds])];
  }

  const nextMaxCapacity =
    data.maxCapacity !== undefined ? data.maxCapacity : existing.maxCapacity;
  let allocatedSumForCapacity;
  if (nationalities !== undefined) {
    allocatedSumForCapacity = sumAllocatedFromRows(nationalities);
  } else {
    const { _sum } = await prisma.serviceCenterNationality.aggregate({
      where: { serviceCenterId: id },
      _sum: { pilgrimsCount: true },
    });
    allocatedSumForCapacity = _sum.pilgrimsCount ?? 0;
  }
  assertAllocatedWithinMaxCapacity(nextMaxCapacity, allocatedSumForCapacity);
  if (nationalities !== undefined) {
    await assertCenterNationalityBusinessRules(id, nationalities);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const effectiveCode =
      data.code !== undefined ? String(data.code).trim() : existing.code;
    if (data.code !== undefined && !effectiveCode) {
      const err = new Error('Center code cannot be empty');
      err.code = 'CODE_REQUIRED';
      throw err;
    }

    const { name: autoName, nameAr: autoNameAr } = autoCenterDisplayNames(effectiveCode);

    const payload = {
      name: autoName,
      nameAr: autoNameAr,
    };
    if (data.code !== undefined) payload.code = effectiveCode;
    if (data.presidentName !== undefined) payload.presidentName = data.presidentName?.trim() || null;
    if (data.vicePresidentName !== undefined) payload.vicePresidentName = data.vicePresidentName?.trim() || null;
    if (data.maxCapacity !== undefined) payload.maxCapacity = data.maxCapacity;

    await tx.serviceCenter.update({ where: { id }, data: payload });

    if (nationalities !== undefined) {
      await tx.serviceCenterNationality.deleteMany({ where: { serviceCenterId: id } });
      if (nationalities.length) {
        await tx.serviceCenterNationality.createMany({
          data: nationalities.map((n) => ({
            serviceCenterId: id,
            pilgrimNationalityId: n.pilgrimNationalityId,
            pilgrimsCount: n.pilgrimsCount,
            arrivingPilgrimsCount: n.arrivingPilgrimsCount,
          })),
        });
      }
    }

    return tx.serviceCenter.findUnique({
      where: { id },
      include: centerInclude,
    });
  });

  if (nationalityIdsToSyncAfterUpdate.length) {
    await pilgrimNationalityService.syncArrivingTotalsForNationalityIds(nationalityIdsToSyncAfterUpdate);
  }

  return updated;
}

async function remove(id) {
  const existing = await prisma.serviceCenter.findUnique({ where: { id } });
  if (!existing) return false;

  const linksBefore = await prisma.serviceCenterNationality.findMany({
    where: { serviceCenterId: id },
    select: { pilgrimNationalityId: true },
  });
  const affectedNationalityIds = [...new Set(linksBefore.map((l) => l.pilgrimNationalityId))];

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { serviceCenterId: id },
      data: { serviceCenterId: null },
    }),
    prisma.serviceCenter.delete({ where: { id } }),
  ]);

  if (affectedNationalityIds.length) {
    await pilgrimNationalityService.syncArrivingTotalsForNationalityIds(affectedNationalityIds);
  }

  return true;
}

async function listUsersForCenter(serviceCenterId) {
  return prisma.user.findMany({
    where: { serviceCenterId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: USER_LIST_SELECT,
  });
}

/** Reception dashboard: all centers with allocation / arrival aggregates (read-only). */
async function listForReceptionOverview() {
  const centers = await prisma.serviceCenter.findMany({
    orderBy: [{ code: 'asc' }, { createdAt: 'desc' }],
    include: {
      nationalities: {
        include: {
          nationality: { select: { id: true, code: true, flagCode: true, name: true, nameAr: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return centers.map((c) => {
    let totalAllocated = 0;
    let totalArrived = 0;
    for (const l of c.nationalities || []) {
      totalAllocated += l.pilgrimsCount ?? 0;
      totalArrived += l.arrivingPilgrimsCount ?? 0;
    }
    const arrivedPercent =
      totalAllocated > 0 ? Math.min(100, Math.round((totalArrived / totalAllocated) * 100)) : 0;
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      nameAr: c.nameAr,
      maxCapacity: c.maxCapacity,
      totalAllocated,
      totalArrived,
      arrivedPercent,
      nationalities: (c.nationalities || []).map((l) => ({
        id: l.nationality?.id,
        code: l.nationality?.code,
        flagCode: l.nationality?.flagCode,
        name: l.nationality?.name,
        nameAr: l.nationality?.nameAr,
      })),
    };
  });
}

/**
 * Reception: aggregate allocated / arrived pilgrims per nationality across all service centers.
 */
async function listForReceptionNationalitiesOverview() {
  const [allNationalities, grouped] = await Promise.all([
    prisma.pilgrimNationality.findMany({
      select: { id: true, code: true, flagCode: true, name: true, nameAr: true },
      orderBy: [{ name: 'asc' }],
    }),
    prisma.serviceCenterNationality.groupBy({
      by: ['pilgrimNationalityId'],
      _sum: {
        pilgrimsCount: true,
        arrivingPilgrimsCount: true,
      },
    }),
  ]);

  const sums = new Map(
    grouped.map((g) => [
      g.pilgrimNationalityId,
      {
        alloc: g._sum.pilgrimsCount ?? 0,
        arr: g._sum.arrivingPilgrimsCount ?? 0,
      },
    ])
  );

  return allNationalities.map((n) => {
    const s = sums.get(n.id) || { alloc: 0, arr: 0 };
    const arrivedPercent =
      s.alloc > 0 ? Math.min(100, Math.round((s.arr / s.alloc) * 100)) : 0;
    return {
      id: n.id,
      code: n.code,
      flagCode: n.flagCode,
      name: n.name,
      nameAr: n.nameAr,
      totalAllocated: s.alloc,
      totalArrived: s.arr,
      arrivedPercent,
    };
  });
}

module.exports = {
  listPublicCatalog,
  list,
  getById,
  create,
  update,
  remove,
  listUsersForCenter,
  listForReceptionOverview,
  listForReceptionNationalitiesOverview,
};
