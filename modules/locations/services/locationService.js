const { prisma } = require('../../users/models');

async function getLocations(options = {}) {
  const { isActive } = options;
  const where = {};
  if (isActive !== undefined) where.isActive = isActive;

  return prisma.shift_Location.findMany({
    where,
    orderBy: { name: 'asc' },
  });
}

async function getLocationById(id) {
  return prisma.shift_Location.findUnique({ where: { id } });
}

async function createLocation(data) {
  return prisma.shift_Location.create({
    data: {
      name: data.name.trim(),
      locationAr: data.locationAr ? data.locationAr.trim() : null,
      zoneCenterLat: data.zoneCenterLat ?? null,
      zoneCenterLng: data.zoneCenterLng ?? null,
      zoneRadiusMeters: data.zoneRadiusMeters ?? null,
      isActive: data.isActive !== false,
    },
  });
}

async function updateLocation(id, data) {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.locationAr !== undefined) {
    payload.locationAr = data.locationAr === null ? null : data.locationAr.trim();
  }
  if (data.zoneCenterLat !== undefined) payload.zoneCenterLat = data.zoneCenterLat ?? null;
  if (data.zoneCenterLng !== undefined) payload.zoneCenterLng = data.zoneCenterLng ?? null;
  if (data.zoneRadiusMeters !== undefined) payload.zoneRadiusMeters = data.zoneRadiusMeters ?? null;
  if (data.isActive !== undefined) payload.isActive = data.isActive;

  return prisma.shift_Location.update({ where: { id }, data: payload });
}

module.exports = {
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
};
