const { prisma } = require('../../users/models');

/**
 * List groups (optionally by locationId).
 */
async function getGroups(options = {}) {
  const { locationId } = options;
  const where = {};
  if (locationId) where.locationId = locationId;

  return prisma.group.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      location: { select: { id: true, name: true } },
      _count: { select: { permissions: true, userGroups: true } },
    },
  });
}

/**
 * Get one group by id with location, permissions, and users.
 */
async function getGroupById(id) {
  return prisma.group.findUnique({
    where: { id },
    include: {
      location: true,
      permissions: { include: { permission: true } },
      userGroups: { include: { user: { select: { id: true, fullName: true, email: true } } } },
    },
  });
}

/**
 * Create group.
 */
async function createGroup(data) {
  return prisma.group.create({
    data: {
      name: data.name.trim(),
      locationId: data.locationId || null,
      description: data.description?.trim() || null,
    },
    include: { location: true },
  });
}

/**
 * Update group.
 */
async function updateGroup(id, data) {
  const updatePayload = {};
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.locationId !== undefined) updatePayload.locationId = data.locationId || null;
  if (data.description !== undefined) updatePayload.description = data.description?.trim() || null;

  return prisma.group.update({
    where: { id },
    data: updatePayload,
    include: { location: true },
  });
}

/**
 * Delete group.
 */
async function deleteGroup(id) {
  return prisma.group.delete({
    where: { id },
  });
}

/**
 * Set permissions for a group (replace existing).
 */
async function setGroupPermissions(groupId, permissionIds) {
  await prisma.groupPermission.deleteMany({ where: { groupId } });
  if (permissionIds.length > 0) {
    await prisma.groupPermission.createMany({
      data: permissionIds.map((permissionId) => ({ groupId, permissionId })),
      skipDuplicates: true,
    });
  }
  return getGroupById(groupId);
}

/**
 * Set users in a group (replace existing).
 */
async function setGroupUsers(groupId, userIds) {
  await prisma.userGroup.deleteMany({ where: { groupId } });
  if (userIds.length > 0) {
    await prisma.userGroup.createMany({
      data: userIds.map((userId) => ({ groupId, userId })),
      skipDuplicates: true,
    });
  }
  return getGroupById(groupId);
}

module.exports = {
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  setGroupPermissions,
  setGroupUsers,
};
