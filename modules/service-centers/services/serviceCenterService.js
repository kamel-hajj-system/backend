const { prisma } = require('../../users/models');
const { normEntityName, normServiceCenterCode } = require('../../nusuk/nusukColumnMap');

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

/**
 * Pilgrims counted as "actually arrived" from one Nusuk sheet row (shared by reception overviews).
 */
function actualArrivalContributionFromNusukRow(row) {
  const st = row.actualArrivalStatus;
  const pc = row.pilgrimsCount != null && Number.isFinite(Number(row.pilgrimsCount)) ? Number(row.pilgrimsCount) : 0;
  const acRaw = row.actualArrivalCount;
  const ac = acRaw != null && Number.isFinite(Number(acRaw)) ? Number(acRaw) : null;
  if (st === 'yes') return ac != null ? ac : pc;
  if (st === 'partial') return ac != null ? ac : 0;
  return 0;
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
  const nusukRows = await prisma.nusukSheetRow.findMany({
    select: {
      entityName: true,
      pilgrimsCount: true,
      actualArrivalStatus: true,
      actualArrivalCount: true,
      rowData: true,
    },
  });
  const companiesForLookup = await prisma.pilgrimCompany.findMany({
    select: { id: true, name: true },
  });
  const companyIdByName = new Map();
  for (const co of companiesForLookup) {
    const key = normEntityName(co.name);
    if (key && !companyIdByName.has(key)) companyIdByName.set(key, co.id);
  }

  /**
   * Nusuk rows are global; each row carries `rowData.serviceCenterCode` (رقم مركز الخدمة).
   * Reception totals per center must only sum rows for that center's code — same rule as the
   * service center portal (`listRowsForServiceCenter`). Otherwise one center's edits appear
   * under every center that shares an allocated company (wrong cross-center attribution).
   */
  const byCenterCodeAndCompany = new Map();
  const byCenterCodeOnly = new Map();
  for (const row of nusukRows) {
    const nameKey = normEntityName(row.entityName);
    const companyId = nameKey ? companyIdByName.get(nameKey) : null;
    if (!companyId) continue;
    const rd = row.rowData && typeof row.rowData === 'object' ? row.rowData : {};
    const rowSc = normServiceCenterCode(rd.serviceCenterCode);
    if (!rowSc) continue;

    const p =
      row.pilgrimsCount != null && Number.isFinite(Number(row.pilgrimsCount))
        ? Number(row.pilgrimsCount)
        : 0;
    const a = actualArrivalContributionFromNusukRow(row);

    const pairKey = `${rowSc}|${companyId}`;
    if (!byCenterCodeAndCompany.has(pairKey)) byCenterCodeAndCompany.set(pairKey, { pilgrims: 0, actual: 0 });
    const pair = byCenterCodeAndCompany.get(pairKey);
    pair.pilgrims += p;
    pair.actual += a;

    if (!byCenterCodeOnly.has(rowSc)) byCenterCodeOnly.set(rowSc, { pilgrims: 0, actual: 0 });
    const tot = byCenterCodeOnly.get(rowSc);
    tot.pilgrims += p;
    tot.actual += a;
  }

  return centers.map((c) => {
    const cNorm = normServiceCenterCode(c.code);
    const centerSums = byCenterCodeOnly.get(cNorm) ?? { pilgrims: 0, actual: 0 };
    let totalAllocated = 0;
    for (const l of c.pilgrimCompanyAllocations || []) {
      totalAllocated += l.allocatedPilgrims ?? 0;
    }
    const totalIntegrated = centerSums.pilgrims;
    const totalActualArrival = centerSums.actual;
    const integratedPercent =
      totalAllocated > 0 ? Math.min(100, Math.round((totalIntegrated / totalAllocated) * 100)) : 0;
    const actualArrivalPercent =
      totalAllocated > 0 ? Math.min(100, Math.round((totalActualArrival / totalAllocated) * 100)) : 0;
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      nameAr: c.nameAr,
      maxCapacity: c.maxCapacity,
      totalAllocated,
      totalIntegrated,
      integratedPercent,
      totalActualArrival,
      actualArrivalPercent,
      companies: (c.pilgrimCompanyAllocations || []).map((l) => {
        const pid = l.pilgrimCompany?.id;
        const pairKey = pid ? `${cNorm}|${pid}` : null;
        const sums = pairKey ? byCenterCodeAndCompany.get(pairKey) : null;
        const merged = sums?.pilgrims ?? 0;
        const act = sums?.actual ?? 0;
        return {
          id: l.pilgrimCompany?.id,
          externalCode: l.pilgrimCompany?.externalCode,
          name: l.pilgrimCompany?.name,
          nameAr: l.pilgrimCompany?.nameAr,
          allocatedPilgrims: l.allocatedPilgrims ?? 0,
          mergedActualPilgrimsCount: merged,
          nusukEntered: merged,
          actualArrival: act,
        };
      }),
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
  const nusukRows = await prisma.nusukSheetRow.findMany({
    select: {
      entityName: true,
      pilgrimsCount: true,
      actualArrivalStatus: true,
      actualArrivalCount: true,
    },
  });

  // Aggregate Nusuk counts by company name (same normalization used in Nusuk module).
  const byCompanyName = new Map();
  const actualArrivalByNameKey = new Map();
  for (const row of nusukRows) {
    const key = normEntityName(row.entityName);
    if (!key) continue;
    if (!byCompanyName.has(key)) byCompanyName.set(key, { sum: 0, rowCount: 0 });
    const agg = byCompanyName.get(key);
    agg.rowCount += 1;
    if (row.pilgrimsCount != null && Number.isFinite(Number(row.pilgrimsCount))) {
      agg.sum += Number(row.pilgrimsCount);
    }
    if (!actualArrivalByNameKey.has(key)) actualArrivalByNameKey.set(key, 0);
    actualArrivalByNameKey.set(key, actualArrivalByNameKey.get(key) + actualArrivalContributionFromNusukRow(row));
  }

  return companies.map((c) => {
    const allocatedAcrossCenters = (c.serviceCenterLinks || []).reduce(
      (s, l) => s + (l.allocatedPilgrims ?? 0),
      0
    );
    const nameKey = normEntityName(c.name);
    const nusukAgg = nameKey ? byCompanyName.get(nameKey) : null;
    const matched = nusukAgg?.sum ?? 0;
    const matchedPercent =
      c.expectedPilgrimsCount > 0
        ? Math.min(100, Math.round((matched / c.expectedPilgrimsCount) * 100))
        : 0;
    const actualArrival = nameKey ? (actualArrivalByNameKey.get(nameKey) ?? 0) : 0;
    const actualArrivalPercent =
      c.expectedPilgrimsCount > 0
        ? Math.min(100, Math.round((actualArrival / c.expectedPilgrimsCount) * 100))
        : 0;

    return {
      id: c.id,
      externalCode: c.externalCode,
      name: c.name,
      nameAr: c.nameAr,
      expectedPilgrimsCount: c.expectedPilgrimsCount,
      mergedActualPilgrimsCount: matched,
      nusukEntered: matched,
      nusukRowCount: nusukAgg?.rowCount ?? 0,
      allocatedAcrossCenters,
      matchedPercent,
      actualArrival,
      actualArrivalPercent,
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

/** Reception dashboard: all nationalities with Nusuk-input aggregates (read-only). */
async function listForReceptionNationalitiesOverview() {
  const [nationalities, nusukRows] = await Promise.all([
    prisma.pilgrimNationality.findMany({
      orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
      include: {
        companyLinks: {
          include: {
            pilgrimCompany: {
              include: {
                serviceCenterLinks: {
                  include: { serviceCenter: { select: { id: true, code: true, name: true, nameAr: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.nusukSheetRow.findMany({
      select: {
        entityName: true,
        pilgrimsCount: true,
        actualArrivalStatus: true,
        actualArrivalCount: true,
      },
    }),
  ]);

  const companyRows = await prisma.pilgrimCompany.findMany({ select: { id: true, name: true } });
  const companyIdByName = new Map();
  for (const c of companyRows) {
    const key = normEntityName(c.name);
    if (key && !companyIdByName.has(key)) companyIdByName.set(key, c.id);
  }

  const nusukByCompanyId = new Map();
  const actualArrivalByCompanyId = new Map();
  for (const row of nusukRows) {
    const nameKey = normEntityName(row.entityName);
    const companyId = nameKey ? companyIdByName.get(nameKey) : null;
    if (!companyId) continue;
    if (!nusukByCompanyId.has(companyId)) nusukByCompanyId.set(companyId, 0);
    if (row.pilgrimsCount != null && Number.isFinite(Number(row.pilgrimsCount))) {
      nusukByCompanyId.set(companyId, nusukByCompanyId.get(companyId) + Number(row.pilgrimsCount));
    }
    if (!actualArrivalByCompanyId.has(companyId)) actualArrivalByCompanyId.set(companyId, 0);
    actualArrivalByCompanyId.set(
      companyId,
      actualArrivalByCompanyId.get(companyId) + actualArrivalContributionFromNusukRow(row)
    );
  }

  return nationalities.map((n) => {
    const companies = (n.companyLinks || [])
      .map((l) => l.pilgrimCompany)
      .filter(Boolean);
    const uniqueCompanies = new Map(companies.map((c) => [c.id, c]));
    const companyList = Array.from(uniqueCompanies.values());
    const expectedPilgrims = companyList.reduce((s, c) => s + (c.expectedPilgrimsCount || 0), 0);
    const nusukInput = companyList.reduce((s, c) => s + (nusukByCompanyId.get(c.id) || 0), 0);
    const inputPercent = expectedPilgrims > 0 ? Math.min(100, Math.round((nusukInput / expectedPilgrims) * 100)) : 0;
    const actualArrival = companyList.reduce((s, c) => s + (actualArrivalByCompanyId.get(c.id) || 0), 0);
    const actualArrivalPercent =
      expectedPilgrims > 0 ? Math.min(100, Math.round((actualArrival / expectedPilgrims) * 100)) : 0;
    const centersMap = new Map();
    companyList.forEach((c) => {
      (c.serviceCenterLinks || []).forEach((link) => {
        const sc = link.serviceCenter;
        if (sc?.id && !centersMap.has(sc.id)) centersMap.set(sc.id, sc);
      });
    });

    return {
      id: n.id,
      code: n.code,
      flagCode: n.flagCode,
      name: n.name,
      nameAr: n.nameAr,
      companiesCount: companyList.length,
      expectedPilgrims,
      nusukInput,
      inputPercent,
      actualArrival,
      actualArrivalPercent,
      companies: companyList.map((c) => ({
        id: c.id,
        externalCode: c.externalCode,
        name: c.name,
        nameAr: c.nameAr,
        expectedPilgrimsCount: c.expectedPilgrimsCount || 0,
        nusukInput: nusukByCompanyId.get(c.id) || 0,
        actualArrival: actualArrivalByCompanyId.get(c.id) || 0,
      })),
      centers: Array.from(centersMap.values()),
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
  listForReceptionNationalitiesOverview,
};
