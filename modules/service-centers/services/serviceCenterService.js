const { prisma } = require('../../users/models');

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
  pilgrimCompanyAllocations: {
    include: { pilgrimCompany: true },
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

function sumAllocatedFromRows(rows) {
  return (rows || []).reduce((s, n) => s + (Number.isFinite(n.allocatedPilgrims) ? n.allocatedPilgrims : 0), 0);
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
      `Total pilgrims allocated across pilgrim companies (${allocatedSum}) exceeds this center's maximum capacity (${cap}). Reduce allocations or increase max capacity.`
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

function normalizeCompanyRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && r.pilgrimCompanyId)
    .map((r) => ({
      pilgrimCompanyId: r.pilgrimCompanyId,
      allocatedPilgrims: Number.isFinite(r.allocatedPilgrims) ? r.allocatedPilgrims : 0,
    }));
}

async function assertCenterCompanyBusinessRules(rows) {
  const normalized = normalizeCompanyRows(rows);
  const seen = new Set();
  for (const row of normalized) {
    if (seen.has(row.pilgrimCompanyId)) {
      const err = new Error('Each pilgrim company can only appear once per service center.');
      err.code = 'DUPLICATE_PILGRIM_COMPANY_IN_CENTER';
      throw err;
    }
    seen.add(row.pilgrimCompanyId);
  }
}

async function create(data) {
  const code = data.code != null ? String(data.code).trim() : '';
  if (!code) {
    const err = new Error('Center code is required (e.g. 110)');
    err.code = 'CODE_REQUIRED';
    throw err;
  }

  const companies = normalizeCompanyRows(data.companies);
  if (companies.length) {
    const ids = [...new Set(companies.map((n) => n.pilgrimCompanyId))];
    const found = await prisma.pilgrimCompany.count({ where: { id: { in: ids } } });
    if (found !== ids.length) {
      const err = new Error('One or more pilgrim company ids are invalid');
      err.code = 'INVALID_PILGRIM_COMPANY';
      throw err;
    }
  }

  const maxCap = data.maxCapacity !== undefined && data.maxCapacity !== null ? data.maxCapacity : null;
  assertAllocatedWithinMaxCapacity(maxCap, sumAllocatedFromRows(companies));
  await assertCenterCompanyBusinessRules(companies);

  const { name: autoName, nameAr: autoNameAr } = autoCenterDisplayNames(code);

  const created = await prisma.serviceCenter.create({
    data: {
      code,
      name: autoName,
      nameAr: autoNameAr,
      presidentName: data.presidentName?.trim() || null,
      vicePresidentName: data.vicePresidentName?.trim() || null,
      maxCapacity: data.maxCapacity ?? null,
      pilgrimCompanyAllocations:
        companies.length > 0
          ? {
              create: companies.map((n) => ({
                pilgrimCompanyId: n.pilgrimCompanyId,
                allocatedPilgrims: n.allocatedPilgrims,
              })),
            }
          : undefined,
    },
    include: centerInclude,
  });
  return created;
}

async function update(id, data) {
  const existing = await prisma.serviceCenter.findUnique({ where: { id } });
  if (!existing) return null;

  const companies = data.companies !== undefined ? normalizeCompanyRows(data.companies) : undefined;
  if (companies && companies.length) {
    const ids = [...new Set(companies.map((n) => n.pilgrimCompanyId))];
    const found = await prisma.pilgrimCompany.count({ where: { id: { in: ids } } });
    if (found !== ids.length) {
      const err = new Error('One or more pilgrim company ids are invalid');
      err.code = 'INVALID_PILGRIM_COMPANY';
      throw err;
    }
  }

  const nextMaxCapacity =
    data.maxCapacity !== undefined ? data.maxCapacity : existing.maxCapacity;
  let allocatedSumForCapacity;
  if (companies !== undefined) {
    allocatedSumForCapacity = sumAllocatedFromRows(companies);
  } else {
    const { _sum } = await prisma.serviceCenterPilgrimCompany.aggregate({
      where: { serviceCenterId: id },
      _sum: { allocatedPilgrims: true },
    });
    allocatedSumForCapacity = _sum.allocatedPilgrims ?? 0;
  }
  assertAllocatedWithinMaxCapacity(nextMaxCapacity, allocatedSumForCapacity);
  if (companies !== undefined) {
    await assertCenterCompanyBusinessRules(companies);
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

    if (companies !== undefined) {
      await tx.serviceCenterPilgrimCompany.deleteMany({ where: { serviceCenterId: id } });
      if (companies.length) {
        await tx.serviceCenterPilgrimCompany.createMany({
          data: companies.map((n) => ({
            serviceCenterId: id,
            pilgrimCompanyId: n.pilgrimCompanyId,
            allocatedPilgrims: n.allocatedPilgrims,
          })),
        });
      }
    }

    return tx.serviceCenter.findUnique({
      where: { id },
      include: centerInclude,
    });
  });

  return updated;
}

async function remove(id) {
  const existing = await prisma.serviceCenter.findUnique({ where: { id } });
  if (!existing) return false;

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { serviceCenterId: id },
      data: { serviceCenterId: null },
    }),
    prisma.serviceCenter.delete({ where: { id } }),
  ]);

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
      pilgrimCompanyAllocations: {
        include: {
          pilgrimCompany: { select: { id: true, externalCode: true, name: true, nameAr: true, mergedActualPilgrimsCount: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return centers.map((c) => {
    let totalAllocated = 0;
    let totalIntegrated = 0;
    for (const l of c.pilgrimCompanyAllocations || []) {
      totalAllocated += l.allocatedPilgrims ?? 0;
      totalIntegrated += l.pilgrimCompany?.mergedActualPilgrimsCount ?? 0;
    }
    const integratedPercent =
      totalAllocated > 0 ? Math.min(100, Math.round((totalIntegrated / totalAllocated) * 100)) : 0;
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      nameAr: c.nameAr,
      maxCapacity: c.maxCapacity,
      totalAllocated,
      totalIntegrated,
      integratedPercent,
      companies: (c.pilgrimCompanyAllocations || []).map((l) => ({
        id: l.pilgrimCompany?.id,
        externalCode: l.pilgrimCompany?.externalCode,
        name: l.pilgrimCompany?.name,
        nameAr: l.pilgrimCompany?.nameAr,
        allocatedPilgrims: l.allocatedPilgrims ?? 0,
        mergedActualPilgrimsCount: l.pilgrimCompany?.mergedActualPilgrimsCount ?? 0,
      })),
    };
  });
}

/** Reception dashboard: all pilgrim companies with center allocation aggregates (read-only). */
async function listForReceptionPilgrimCompaniesOverview() {
  const companies = await prisma.pilgrimCompany.findMany({
    orderBy: [{ externalCode: 'asc' }, { createdAt: 'desc' }],
    include: {
      serviceCenterLinks: {
        include: {
          serviceCenter: { select: { id: true, code: true, name: true, nameAr: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      nationalities: {
        include: { nationality: { select: { id: true, code: true, flagCode: true, name: true, nameAr: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return companies.map((c) => {
    const allocatedAcrossCenters = (c.serviceCenterLinks || []).reduce(
      (s, l) => s + (l.allocatedPilgrims ?? 0),
      0
    );
    const matched = c.mergedActualPilgrimsCount ?? 0;
    const matchedPercent =
      c.expectedPilgrimsCount > 0
        ? Math.min(100, Math.round((matched / c.expectedPilgrimsCount) * 100))
        : 0;

    return {
      id: c.id,
      externalCode: c.externalCode,
      name: c.name,
      nameAr: c.nameAr,
      expectedPilgrimsCount: c.expectedPilgrimsCount,
      mergedActualPilgrimsCount: c.mergedActualPilgrimsCount,
      allocatedAcrossCenters,
      matchedPercent,
      centers: (c.serviceCenterLinks || []).map((l) => ({
        id: l.serviceCenter?.id,
        code: l.serviceCenter?.code,
        name: l.serviceCenter?.name,
        nameAr: l.serviceCenter?.nameAr,
        allocatedPilgrims: l.allocatedPilgrims ?? 0,
      })),
      nationalities: (c.nationalities || []).map((n) => ({
        id: n.nationality?.id,
        code: n.nationality?.code,
        flagCode: n.nationality?.flagCode,
        name: n.nationality?.name,
        nameAr: n.nationality?.nameAr,
      })),
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
  listForReceptionPilgrimCompaniesOverview,
};
