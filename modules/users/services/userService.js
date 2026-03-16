const { prisma } = require('../models');
const { AuditAction, ENTITY_USER, SUPER_ADMIN_EMAIL } = require('../models/constants');
const authService = require('./authService');
const auditService = require('./auditService');
const permissionService = require('../../permissions/services/permissionService');

/**
 * Merge permission names from direct userPermissions and from userGroups (for display in dashboard).
 */
function mergePermissionNames(user) {
  const direct = (user.userPermissions || []).map((up) => up.permission?.name).filter(Boolean);
  const fromGroups = (user.userGroups || []).flatMap((ug) =>
    (ug.group?.permissions || []).map((gp) => gp.permission?.name).filter(Boolean)
  );
  return [...new Set([...direct, ...fromGroups])];
}

/**
 * List users (exclude soft-deleted). Pagination and filters.
 * Each user includes permissionNames (direct + from groups) for dashboard display.
 */
async function getUsers(options = {}) {
  const { page = 1, limit = 20, isActive, role, locationId } = options;
  const where = { isDeleted: false };
  if (isActive !== undefined) where.isActive = isActive;
  if (role) where.role = role;
  if (locationId) where.locationId = locationId;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        fullNameAr: true,
        email: true,
        phone: true,
        userType: true,
        role: true,
        jobTitle: true,
        shiftId: true,
        locationId: true,
        supervisorId: true,
        serviceCenterId: true,
        shift: true,
        location: true,
        isActive: true,
        isSuperAdmin: true,
        createdAt: true,
        updatedAt: true,
        userPermissions: {
          select: {
            permission: { select: { id: true, name: true, module: true } },
          },
        },
        userGroups: {
          select: {
            group: {
              select: {
                permissions: {
                  select: { permission: { select: { id: true, name: true, module: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const data = users.map((u) => ({ ...u, permissionNames: mergePermissionNames(u) }));
  return { data, total, page, limit };
}

/**
 * Get user by ID (exclude soft-deleted unless explicitly requested).
 */
async function getUserById(id, options = {}) {
  const { includeDeleted = false } = options;
  const where = { id };
  if (!includeDeleted) where.isDeleted = false;

  const user = await prisma.user.findFirst({
    where,
    include: {
      shift: true,
      location: true,
      supervisor: {
        select: {
          id: true,
          fullName: true,
          fullNameAr: true,
          email: true,
          role: true,
        },
      },
      userPermissions: { include: { permission: true } },
      userGroups: {
        select: {
          group: {
            select: {
              permissions: {
                select: { permission: { select: { id: true, name: true, module: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!user) return null;
  const sanitized = authService.sanitizeUser(user);
  sanitized.permissionNames = mergePermissionNames(user);
  return sanitized;
}

/**
 * Register employee (public). Role=Employee, userType=Company. shiftId must be for employee.
 */
async function registerEmployee(data) {
  const shift = await prisma.shift.findUnique({
    where: { id: data.shiftId },
  });
  if (!shift) {
    const err = new Error('Shift not found');
    err.code = 'SHIFT_NOT_FOUND';
    throw err;
  }
  if (!shift.isForEmployee) {
    const err = new Error('This shift is not available for employee registration');
    err.code = 'SHIFT_NOT_FOR_EMPLOYEE';
    throw err;
  }
  const location = await prisma.location.findUnique({
    where: { id: data.locationId },
  });
  if (!location || !location.isActive) {
    const err = new Error('Location not found or inactive');
    err.code = 'LOCATION_INVALID';
    throw err;
  }
  return createUser(
    {
      ...data,
      userType: 'Company',
      role: 'Employee',
      locationId: data.locationId,
      shiftId: data.shiftId,
      supervisorId: data.supervisorId || null,
      serviceCenterId: null,
    },
    null
  );
}

/**
 * Register service center user (public). Role=Supervisor, userType=ServiceCenter.
 */
async function registerServiceCenter(data) {
  return createUser(
    {
      ...data,
      userType: 'ServiceCenter',
      role: 'Supervisor',
      locationId: null,
      shiftId: null,
      supervisorId: null,
      serviceCenterId: data.serviceCenterId || null,
    },
    null
  );
}

/**
 * Create user. Hashes password and creates audit log.
 */
async function createUser(data, actorId = null) {
  const passwordHash = await authService.hashPassword(data.password);
  const createData = {
    fullName: data.fullName.trim(),
    fullNameAr: data.fullNameAr?.trim() || null,
    email: data.email.trim().toLowerCase(),
    passwordHash,
    phone: data.phone?.trim() || null,
    userType: data.userType,
    role: data.role || 'Employee',
    jobTitle: data.jobTitle?.trim() || null,
    shiftId: data.shiftId || null,
    locationId: data.locationId || null,
    supervisorId: data.supervisorId || null,
    serviceCenterId: data.serviceCenterId || null,
    isActive: data.isActive !== false,
  };

  const user = await prisma.user.create({
    data: createData,
  });

  let defaultPermissionIds = await permissionService.getDefaultPermissionIds(createData.userType);
  if (defaultPermissionIds.length === 0) {
    defaultPermissionIds = await permissionService.getFallbackDefaultPermissionIds(createData.userType);
  }
  if (defaultPermissionIds.length > 0) {
    await prisma.userPermission.createMany({
      data: defaultPermissionIds.map((permissionId) => ({ userId: user.id, permissionId })),
      skipDuplicates: true,
    });
  }

  await auditService.createAuditLog({
    userId: actorId,
    action: AuditAction.CREATE,
    entityType: ENTITY_USER,
    entityId: user.id,
    afterValue: authService.sanitizeUser(user),
  });

  const userWithPermissions = await prisma.user.findUnique({
    where: { id: user.id },
    include: { userPermissions: { include: { permission: true } } },
  });
  return userWithPermissions ? authService.sanitizeUser(userWithPermissions) : authService.sanitizeUser(user);
}

/**
 * Update user. Audit log with before/after.
 */
async function updateUser(id, data, actorId = null) {
  const existing = await prisma.user.findFirst({
    where: { id, isDeleted: false },
  });
  if (!existing) return null;

  const updatePayload = {};
  if (data.fullName !== undefined) updatePayload.fullName = data.fullName.trim();
  if (data.fullNameAr !== undefined) updatePayload.fullNameAr = data.fullNameAr?.trim() || null;
  if (data.email !== undefined) updatePayload.email = data.email.trim().toLowerCase();
  if (data.phone !== undefined) updatePayload.phone = data.phone?.trim() || null;
  if (data.userType !== undefined) updatePayload.userType = data.userType;
  if (data.role !== undefined) updatePayload.role = data.role;
  if (data.jobTitle !== undefined) updatePayload.jobTitle = data.jobTitle?.trim() || null;
  if (data.shiftId !== undefined) updatePayload.shiftId = data.shiftId || null;
  if (data.locationId !== undefined) updatePayload.locationId = data.locationId || null;
  if (data.supervisorId !== undefined) updatePayload.supervisorId = data.supervisorId || null;
  if (data.serviceCenterId !== undefined)
    updatePayload.serviceCenterId = data.serviceCenterId || null;
  if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

  const updated = await prisma.user.update({
    where: { id },
    data: updatePayload,
  });

  await auditService.createAuditLog({
    userId: actorId,
    action: AuditAction.UPDATE,
    entityType: ENTITY_USER,
    entityId: id,
    beforeValue: authService.sanitizeUser(existing),
    afterValue: authService.sanitizeUser(updated),
  });

  return authService.sanitizeUser(updated);
}

/**
 * Soft delete user. Fails for super admin.
 */
async function softDeleteUser(id, actorId = null) {
  const user = await prisma.user.findFirst({
    where: { id, isDeleted: false },
  });
  if (!user) return null;
  if (user.isSuperAdmin && (SUPER_ADMIN_EMAIL || '') && String(user.email).toLowerCase() === String(SUPER_ADMIN_EMAIL).trim().toLowerCase()) {
    const err = new Error('Super admin cannot be deleted');
    err.code = 'SUPER_ADMIN_PROTECTED';
    throw err;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isDeleted: true, isActive: false },
  });

  await auditService.createAuditLog({
    userId: actorId,
    action: AuditAction.DELETE,
    entityType: ENTITY_USER,
    entityId: id,
    beforeValue: authService.sanitizeUser(user),
    afterValue: { isDeleted: true },
  });

  return authService.sanitizeUser(updated);
}

/**
 * Change password. Validates current password, writes audit.
 */
async function changePassword(id, currentPassword, newPassword, actorId = null) {
  const user = await prisma.user.findFirst({
    where: { id, isDeleted: false },
  });
  if (!user) return null;

  const valid = await authService.comparePassword(currentPassword, user.passwordHash);
  if (!valid) {
    const err = new Error('Current password is incorrect');
    err.code = 'INVALID_PASSWORD';
    throw err;
  }

  const passwordHash = await authService.hashPassword(newPassword);
  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  await auditService.createAuditLog({
    userId: actorId ?? id,
    action: AuditAction.PASSWORD_CHANGE,
    entityType: ENTITY_USER,
    entityId: id,
    afterValue: { passwordChanged: true },
  });

  return { success: true };
}

/**
 * Assign role to user. Audit log.
 */
async function assignRole(id, role, actorId = null) {
  const user = await prisma.user.findFirst({
    where: { id, isDeleted: false },
  });
  if (!user) return null;
  if (user.isSuperAdmin && (SUPER_ADMIN_EMAIL || '') && String(user.email).toLowerCase() === String(SUPER_ADMIN_EMAIL).trim().toLowerCase()) {
    const err = new Error('Super admin role cannot be changed');
    err.code = 'SUPER_ADMIN_PROTECTED';
    throw err;
  }

  const beforeValue = { role: user.role };
  const updated = await prisma.user.update({
    where: { id },
    data: { role },
  });

  await auditService.createAuditLog({
    userId: actorId,
    action: AuditAction.ROLE_ASSIGN,
    entityType: ENTITY_USER,
    entityId: id,
    beforeValue,
    afterValue: { role: updated.role },
  });

  return authService.sanitizeUser(updated);
}

/**
 * Assign permissions to user (replace existing). Audit log.
 */
async function assignPermissions(id, permissionIds, actorId = null) {
  const user = await prisma.user.findFirst({
    where: { id, isDeleted: false },
    include: { userPermissions: true },
  });
  if (!user) return null;

  await prisma.userPermission.deleteMany({ where: { userId: id } });
  if (permissionIds.length > 0) {
    await prisma.userPermission.createMany({
      data: permissionIds.map((permissionId) => ({ userId: id, permissionId })),
      skipDuplicates: true,
    });
  }

  const updated = await prisma.user.findUnique({
    where: { id },
    include: { userPermissions: { include: { permission: true } } },
  });

  await auditService.createAuditLog({
    userId: actorId,
    action: AuditAction.PERMISSION_ASSIGN,
    entityType: ENTITY_USER,
    entityId: id,
    afterValue: {
      permissionIds,
      permissionNames: updated.userPermissions.map((up) => up.permission.name),
    },
  });

  return authService.sanitizeUser(updated);
}

module.exports = {
  getUsers,
  getUserById,
  createUser,
  registerEmployee,
  registerServiceCenter,
  updateUser,
  softDeleteUser,
  changePassword,
  assignRole,
  assignPermissions,
};
