const { prisma } = require('../../users/models');
const { UserType } = require('../../users/models/constants');
const { DEFAULT_PERMISSIONS_COMPANY, DEFAULT_PERMISSIONS_SERVICE_CENTER } = require('../constants');

/**
 * List all permissions.
 */
async function getPermissions(options = {}) {
  const { module: moduleFilter } = options;
  const where = {};
  if (moduleFilter) where.module = moduleFilter;

  return prisma.permission.findMany({
    where,
    orderBy: [{ module: 'asc' }, { name: 'asc' }],
  });
}

/**
 * Get one permission by id.
 */
async function getPermissionById(id) {
  return prisma.permission.findUnique({
    where: { id },
  });
}

/**
 * Get permission by name.
 */
async function getPermissionByName(name) {
  return prisma.permission.findUnique({
    where: { name: String(name) },
  });
}

/**
 * Create permission.
 */
async function createPermission(data) {
  return prisma.permission.create({
    data: {
      name: data.name.trim(),
      module: data.module?.trim() || null,
      description: data.description?.trim() || null,
    },
  });
}

/**
 * Update permission.
 */
async function updatePermission(id, data) {
  const updatePayload = {};
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.module !== undefined) updatePayload.module = data.module?.trim() || null;
  if (data.description !== undefined)
    updatePayload.description = data.description?.trim() || null;

  return prisma.permission.update({
    where: { id },
    data: updatePayload,
  });
}

/**
 * Delete permission. Fails if in use by default_permissions or user_permissions (cascade will remove user_permissions; default_permissions has FK).
 */
async function deletePermission(id) {
  return prisma.permission.delete({
    where: { id },
  });
}

/**
 * Get default permission IDs for a user type.
 */
async function getDefaultPermissionIds(userType) {
  const records = await prisma.defaultPermission.findMany({
    where: { userType },
    select: { permissionId: true },
  });
  return records.map((r) => r.permissionId);
}

/**
 * Get default permissions (full) for a user type.
 */
async function getDefaultPermissions(userType) {
  const list = await prisma.defaultPermission.findMany({
    where: { userType },
    include: { permission: true },
    orderBy: { permission: { name: 'asc' } },
  });
  return list.map((dp) => ({ ...dp.permission, isDefault: true }));
}

/**
 * Get defaults grouped by user type (for Super Admin UI).
 */
async function getDefaultsByUserType() {
  const [company, serviceCenter] = await Promise.all([
    getDefaultPermissions(UserType.Company),
    getDefaultPermissions(UserType.ServiceCenter),
  ]);
  return { Company: company, ServiceCenter: serviceCenter };
}

/**
 * Set default permissions for a user type (replace existing).
 */
async function setDefaultPermissions(userType, permissionIds) {
  await prisma.defaultPermission.deleteMany({ where: { userType } });
  if (permissionIds.length > 0) {
    await prisma.defaultPermission.createMany({
      data: permissionIds.map((permissionId) => ({ userType, permissionId })),
      skipDuplicates: true,
    });
  }
  return getDefaultPermissions(userType);
}

/**
 * Resolve permission names to IDs. Throws if any name not found.
 */
async function namesToIds(names) {
  const permissions = await prisma.permission.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true },
  });
  if (permissions.length !== names.length) {
    const found = new Set(permissions.map((p) => p.name));
    const missing = names.filter((n) => !found.has(n));
    const err = new Error(`Permissions not found: ${missing.join(', ')}`);
    err.code = 'PERMISSIONS_NOT_FOUND';
    throw err;
  }
  return permissions.map((p) => p.id);
}

/**
 * Fallback: get default permission IDs from constants (only those that exist in DB).
 * Used when default_permissions table is empty so new users still get e.g. dashboard.view.
 */
async function getFallbackDefaultPermissionIds(userType) {
  const names = userType === UserType.ServiceCenter ? DEFAULT_PERMISSIONS_SERVICE_CENTER : DEFAULT_PERMISSIONS_COMPANY;
  const permissions = await prisma.permission.findMany({
    where: { name: { in: names } },
    select: { id: true },
  });
  return permissions.map((p) => p.id);
}

module.exports = {
  getPermissions,
  getPermissionById,
  getPermissionByName,
  createPermission,
  updatePermission,
  deletePermission,
  getDefaultPermissionIds,
  getDefaultPermissions,
  getDefaultsByUserType,
  setDefaultPermissions,
  namesToIds,
  getFallbackDefaultPermissionIds,
};
