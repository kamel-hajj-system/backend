const { prisma } = require('../../users/models');

/**
 * List locations. Optional filter by isActive (default: all).
 */
async function getLocations(options = {}) {
  const { isActive } = options;
  const where = {};
  if (isActive !== undefined) where.isActive = isActive;

  return prisma.location.findMany({
    where,
    orderBy: { name: 'asc' },
  });
}

/**
 * Get one location by id.
 */
async function getLocationById(id) {
  return prisma.location.findUnique({
    where: { id },
  });
}

/**
 * Create location.
 */
async function createLocation(data) {
  return prisma.location.create({
    data: {
      name: data.name.trim(),
      locationAr: data.locationAr ? data.locationAr.trim() : null,
      isActive: data.isActive !== false,
    },
  });
}

/**
 * Update location.
 */
async function updateLocation(id, data) {
  const updatePayload = {};
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.locationAr !== undefined) {
    updatePayload.locationAr =
      data.locationAr === null ? null : data.locationAr.trim();
  }
  if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

  return prisma.location.update({
    where: { id },
    data: updatePayload,
  });
}

module.exports = {
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
};
