const { prisma } = require('../../users/models');

const include = {
  nationalities: {
    include: { nationality: true },
    orderBy: { createdAt: 'asc' },
  },
  serviceCenterLinks: {
    include: {
      serviceCenter: { select: { id: true, code: true, name: true, nameAr: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
};

function normalizeNationalityIds(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter(Boolean))];
}

function normalizeExpectedCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

async function list() {
  return prisma.pilgrimCompany.findMany({
    orderBy: [{ externalCode: 'asc' }, { createdAt: 'desc' }],
    include,
  });
}

async function getById(id) {
  return prisma.pilgrimCompany.findUnique({
    where: { id },
    include,
  });
}

async function create(data) {
  const nationalityIds = normalizeNationalityIds(data.nationalityIds);
  if (nationalityIds.length) {
    const found = await prisma.pilgrimNationality.count({ where: { id: { in: nationalityIds } } });
    if (found !== nationalityIds.length) {
      const err = new Error('One or more nationality ids are invalid');
      err.code = 'INVALID_NATIONALITY';
      throw err;
    }
  }

  const payload = {
    externalCode: String(data.externalCode || '').trim(),
    name: String(data.name || '').trim(),
    nameAr: data.nameAr?.trim() || null,
    expectedPilgrimsCount: normalizeExpectedCount(data.expectedPilgrimsCount),
    mergedActualPilgrimsCount:
      data.mergedActualPilgrimsCount === undefined || data.mergedActualPilgrimsCount === null
        ? null
        : normalizeExpectedCount(data.mergedActualPilgrimsCount),
    notes: data.notes?.trim() || null,
    nationalities:
      nationalityIds.length > 0
        ? {
            create: nationalityIds.map((pilgrimNationalityId) => ({ pilgrimNationalityId })),
          }
        : undefined,
  };

  if (!payload.externalCode || !payload.name) {
    const err = new Error('externalCode and name are required');
    err.code = 'REQUIRED_FIELDS';
    throw err;
  }

  return prisma.pilgrimCompany.create({
    data: payload,
    include,
  });
}

async function update(id, data) {
  const existing = await prisma.pilgrimCompany.findUnique({ where: { id } });
  if (!existing) return null;

  const nationalityIds = data.nationalityIds !== undefined ? normalizeNationalityIds(data.nationalityIds) : null;
  if (nationalityIds && nationalityIds.length) {
    const found = await prisma.pilgrimNationality.count({ where: { id: { in: nationalityIds } } });
    if (found !== nationalityIds.length) {
      const err = new Error('One or more nationality ids are invalid');
      err.code = 'INVALID_NATIONALITY';
      throw err;
    }
  }

  return prisma.$transaction(async (tx) => {
    const payload = {};
    if (data.externalCode !== undefined) payload.externalCode = String(data.externalCode || '').trim();
    if (data.name !== undefined) payload.name = String(data.name || '').trim();
    if (data.nameAr !== undefined) payload.nameAr = data.nameAr?.trim() || null;
    if (data.notes !== undefined) payload.notes = data.notes?.trim() || null;
    if (data.expectedPilgrimsCount !== undefined) {
      payload.expectedPilgrimsCount = normalizeExpectedCount(data.expectedPilgrimsCount);
    }
    if (data.mergedActualPilgrimsCount !== undefined) {
      payload.mergedActualPilgrimsCount =
        data.mergedActualPilgrimsCount === null ? null : normalizeExpectedCount(data.mergedActualPilgrimsCount);
    }

    if (payload.externalCode === '' || payload.name === '') {
      const err = new Error('externalCode and name cannot be empty');
      err.code = 'REQUIRED_FIELDS';
      throw err;
    }

    await tx.pilgrimCompany.update({ where: { id }, data: payload });

    if (nationalityIds) {
      await tx.pilgrimCompanyNationality.deleteMany({ where: { pilgrimCompanyId: id } });
      if (nationalityIds.length) {
        await tx.pilgrimCompanyNationality.createMany({
          data: nationalityIds.map((pilgrimNationalityId) => ({
            pilgrimCompanyId: id,
            pilgrimNationalityId,
          })),
        });
      }
    }

    return tx.pilgrimCompany.findUnique({ where: { id }, include });
  });
}

async function remove(id) {
  try {
    await prisma.pilgrimCompany.delete({ where: { id } });
    return true;
  } catch (e) {
    if (e.code === 'P2025') return false;
    throw e;
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
