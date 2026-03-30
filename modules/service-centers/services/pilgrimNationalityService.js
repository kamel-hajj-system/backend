const { prisma } = require('../../users/models');

async function list() {
  return prisma.pilgrimNationality.findMany({
    orderBy: [{ name: 'asc' }],
  });
}

async function getById(id) {
  return prisma.pilgrimNationality.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.pilgrimNationality.create({
    data: {
      code: data.code?.trim() || null,
      flagCode: data.flagCode?.trim() || null,
      name: data.name.trim(),
      nameAr: data.nameAr?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });
}

async function update(id, data) {
  const existing = await prisma.pilgrimNationality.findUnique({ where: { id } });
  if (!existing) return null;

  const payload = {};
  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.nameAr !== undefined) payload.nameAr = data.nameAr?.trim() || null;
  if (data.code !== undefined) payload.code = data.code?.trim() || null;
  if (data.flagCode !== undefined) payload.flagCode = data.flagCode?.trim() || null;
  if (data.notes !== undefined) payload.notes = data.notes?.trim() || null;
  return prisma.pilgrimNationality.update({ where: { id }, data: payload });
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
  list,
  getById,
  create,
  update,
  remove,
};
