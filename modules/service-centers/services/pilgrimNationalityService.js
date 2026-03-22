const { prisma } = require('../../users/models');

/**
 * Recompute PilgrimNationality.totalArrivingPilgrimsCount from all ServiceCenterNationality rows
 * for this nationality (sum of arriving per center).
 */
async function syncArrivingTotalFromServiceCenterLinks(pilgrimNationalityId) {
  const { _sum } = await prisma.serviceCenterNationality.aggregate({
    where: { pilgrimNationalityId },
    _sum: { arrivingPilgrimsCount: true },
  });
  const total = _sum.arrivingPilgrimsCount ?? 0;
  await prisma.pilgrimNationality.update({
    where: { id: pilgrimNationalityId },
    data: { totalArrivingPilgrimsCount: total },
  });
}

async function syncArrivingTotalsForNationalityIds(nationalityIds) {
  const unique = [...new Set((nationalityIds || []).filter(Boolean))];
  await Promise.all(unique.map((id) => syncArrivingTotalFromServiceCenterLinks(id)));
}

/** Recompute arriving total for every nationality (e.g. after migration). */
async function syncAllArrivingTotalsFromLinks() {
  const all = await prisma.pilgrimNationality.findMany({ select: { id: true } });
  await Promise.all(all.map((n) => syncArrivingTotalFromServiceCenterLinks(n.id)));
  return { updated: all.length };
}

function assertTotalArrivingNotExceedTotalPilgrims(totalPilgrims, totalArriving) {
  if (totalPilgrims == null || totalArriving == null) return;
  const p = Number(totalPilgrims);
  const a = Number(totalArriving);
  if (!Number.isFinite(p) || !Number.isFinite(a)) return;
  if (a > p) {
    const err = new Error(
      'Total arriving pilgrims cannot be greater than total pilgrims for this nationality.'
    );
    err.code = 'TOTAL_ARRIVING_EXCEEDS_TOTAL_PILGRIMS';
    err.details = { totalPilgrims: p, totalArriving: a };
    throw err;
  }
}

async function list() {
  const [rows, sums] = await Promise.all([
    prisma.pilgrimNationality.findMany({
      orderBy: [{ name: 'asc' }],
    }),
    prisma.serviceCenterNationality.groupBy({
      by: ['pilgrimNationalityId'],
      _sum: { pilgrimsCount: true, arrivingPilgrimsCount: true },
    }),
  ]);
  const sumMap = Object.fromEntries(
    sums.map((s) => [
      s.pilgrimNationalityId,
      {
        allocatedAcrossCenters: s._sum.pilgrimsCount ?? 0,
        arrivingSumAcrossCenters: s._sum.arrivingPilgrimsCount ?? 0,
      },
    ])
  );
  return rows.map((r) => {
    const agg = sumMap[r.id] || { allocatedAcrossCenters: 0, arrivingSumAcrossCenters: 0 };
    return { ...r, ...agg };
  });
}

async function getById(id) {
  return prisma.pilgrimNationality.findUnique({ where: { id } });
}

async function create(data) {
  const totalPilgrimsCount =
    data.totalPilgrimsCount !== undefined && data.totalPilgrimsCount !== null
      ? Number(data.totalPilgrimsCount)
      : null;
  const totalArrivingPilgrimsCount =
    data.totalArrivingPilgrimsCount !== undefined && data.totalArrivingPilgrimsCount !== null
      ? Number(data.totalArrivingPilgrimsCount)
      : null;
  assertTotalArrivingNotExceedTotalPilgrims(totalPilgrimsCount, totalArrivingPilgrimsCount);

  return prisma.pilgrimNationality.create({
    data: {
      code: data.code?.trim() || null,
      flagCode: data.flagCode?.trim() || null,
      name: data.name.trim(),
      nameAr: data.nameAr?.trim() || null,
      notes: data.notes?.trim() || null,
      totalPilgrimsCount,
      totalArrivingPilgrimsCount,
    },
  });
}

async function update(id, data) {
  const existing = await prisma.pilgrimNationality.findUnique({ where: { id } });
  if (!existing) return null;

  const nextTotalPilgrims =
    data.totalPilgrimsCount !== undefined
      ? data.totalPilgrimsCount === null || data.totalPilgrimsCount === ''
        ? null
        : Number(data.totalPilgrimsCount)
      : existing.totalPilgrimsCount;
  const nextTotalArriving =
    data.totalArrivingPilgrimsCount !== undefined
      ? data.totalArrivingPilgrimsCount === null || data.totalArrivingPilgrimsCount === ''
        ? null
        : Number(data.totalArrivingPilgrimsCount)
      : existing.totalArrivingPilgrimsCount;

  assertTotalArrivingNotExceedTotalPilgrims(nextTotalPilgrims, nextTotalArriving);

  if (nextTotalPilgrims != null && Number.isFinite(Number(nextTotalPilgrims))) {
    const { _sum } = await prisma.serviceCenterNationality.aggregate({
      where: { pilgrimNationalityId: id },
      _sum: { pilgrimsCount: true },
    });
    const allocatedAcrossCenters = _sum.pilgrimsCount ?? 0;
    if (allocatedAcrossCenters > Number(nextTotalPilgrims)) {
      const err = new Error(
        `National total pilgrims (${Number(
          nextTotalPilgrims
        )}) cannot be less than what is already allocated across service centers (${allocatedAcrossCenters}). Reduce allocations at centers first.`
      );
      err.code = 'NATIONALITY_TOTAL_BELOW_ALLOCATED';
      err.details = {
        nationalTotal: Number(nextTotalPilgrims),
        allocatedAcrossCenters,
      };
      throw err;
    }
  }

  const payload = {};
  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.nameAr !== undefined) payload.nameAr = data.nameAr?.trim() || null;
  if (data.code !== undefined) payload.code = data.code?.trim() || null;
  if (data.flagCode !== undefined) payload.flagCode = data.flagCode?.trim() || null;
  if (data.notes !== undefined) payload.notes = data.notes?.trim() || null;
  if (data.totalPilgrimsCount !== undefined) {
    payload.totalPilgrimsCount =
      data.totalPilgrimsCount === null || data.totalPilgrimsCount === ''
        ? null
        : Number(data.totalPilgrimsCount);
  }
  if (data.totalArrivingPilgrimsCount !== undefined) {
    payload.totalArrivingPilgrimsCount =
      data.totalArrivingPilgrimsCount === null || data.totalArrivingPilgrimsCount === ''
        ? null
        : Number(data.totalArrivingPilgrimsCount);
  }
  return prisma.pilgrimNationality.update({ where: { id }, data: payload });
}

/**
 * Overview for super admin: national totals + each service center row (allocated, arriving, waiting).
 */
async function getOverview(id) {
  const nationality = await prisma.pilgrimNationality.findUnique({
    where: { id },
    include: {
      serviceCenterLinks: {
        include: {
          serviceCenter: { select: { id: true, code: true, name: true, nameAr: true } },
        },
      },
    },
  });
  if (!nationality) return null;

  const sortedLinks = [...nationality.serviceCenterLinks].sort((a, b) =>
    String(a.serviceCenter?.code || '').localeCompare(String(b.serviceCenter?.code || ''))
  );

  const centers = sortedLinks.map((link) => {
    const allocated = link.pilgrimsCount ?? 0;
    const arriving = link.arrivingPilgrimsCount ?? 0;
    const waiting = Math.max(0, allocated - arriving);
    return {
      linkId: link.id,
      serviceCenterId: link.serviceCenterId,
      centerCode: link.serviceCenter?.code ?? null,
      centerName: link.serviceCenter?.name ?? null,
      centerNameAr: link.serviceCenter?.nameAr ?? null,
      allocatedPilgrims: allocated,
      arrivingPilgrims: arriving,
      waitingPilgrims: waiting,
    };
  });

  const allocatedAcrossCenters = centers.reduce((s, c) => s + c.allocatedPilgrims, 0);
  const arrivingAcrossCenters = centers.reduce((s, c) => s + c.arrivingPilgrims, 0);
  const waitingAcrossCenters = centers.reduce((s, c) => s + c.waitingPilgrims, 0);

  return {
    nationality: {
      id: nationality.id,
      code: nationality.code,
      flagCode: nationality.flagCode,
      name: nationality.name,
      nameAr: nationality.nameAr,
      totalPilgrimsCount: nationality.totalPilgrimsCount,
      totalArrivingPilgrimsCount: nationality.totalArrivingPilgrimsCount,
      notes: nationality.notes,
    },
    aggregates: {
      centerCount: centers.length,
      allocatedAcrossCenters,
      arrivingAcrossCenters,
      waitingAcrossCenters,
    },
    centers,
  };
}

async function remove(id) {
  try {
    await prisma.pilgrimNationality.delete({ where: { id } });
    return true;
  } catch (e) {
    if (e.code === 'P2025') return false;
    throw e;
  }
}

module.exports = {
  syncArrivingTotalFromServiceCenterLinks,
  syncArrivingTotalsForNationalityIds,
  syncAllArrivingTotalsFromLinks,
  list,
  getById,
  getOverview,
  create,
  update,
  remove,
};
