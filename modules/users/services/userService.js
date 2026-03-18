const { prisma } = require('../models');
const { SUPER_ADMIN_EMAIL } = require('../models/constants');
const authService = require('./authService');

const USER_SELECT = {
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
  isActive: true,
  isDeleted: true,
  isSuperAdmin: true,
  isHr: true,
  createdAt: true,
  updatedAt: true,
  shift: { select: { id: true, name: true, shiftAr: true } },
  shiftLocation: { select: { id: true, name: true, locationAr: true } },
  accessGrants: { select: { code: true } },
};

async function getUsers(options = {}) {
  const { page = 1, limit = 50, isActive, role, locationId, userType, excludeSuperAdmin, q } = options;
  const where = { isDeleted: false };
  if (isActive !== undefined) where.isActive = isActive;
  if (role) where.role = role;
  if (locationId) where.locationId = locationId;
  if (userType) where.userType = userType;
  if (excludeSuperAdmin) where.isSuperAdmin = false;
  if (q && String(q).trim() !== '') {
    const term = String(q).trim();
    where.OR = [
      { fullName: { contains: term, mode: 'insensitive' } },
      { fullNameAr: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: USER_SELECT,
    }),
    prisma.user.count({ where }),
  ]);

  return { data: users, total, page, limit };
}

async function bulkAssignSupervisor({ userIds, supervisorId, role }) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return { updated: 0 };

  // Validate supervisor (if provided)
  if (supervisorId) {
    const sup = await prisma.user.findFirst({
      where: { id: supervisorId, isDeleted: false, isSuperAdmin: false, userType: 'Company' },
      select: { id: true, role: true },
    });
    if (!sup || sup.role !== 'Supervisor') {
      const err = new Error('Supervisor not found or invalid');
      err.code = 'SUPERVISOR_INVALID';
      throw err;
    }
  }

  const data = {
    supervisorId: supervisorId || null,
  };
  if (role) data.role = role;

  const result = await prisma.user.updateMany({
    where: {
      id: { in: ids },
      isDeleted: false,
      isSuperAdmin: false,
      userType: 'Company',
    },
    data,
  });

  return { updated: result.count };
}

async function getSupervisorsTree(options = {}) {
  const { locationId, q, includeInactive = true } = options;
  const term = q && String(q).trim() !== '' ? String(q).trim() : null;

  const supWhere = {
    isDeleted: false,
    isSuperAdmin: false,
    userType: 'Company',
    role: 'Supervisor',
  };
  if (!includeInactive) supWhere.isActive = true;
  if (locationId) supWhere.locationId = locationId;
  if (term) {
    supWhere.OR = [
      { fullName: { contains: term, mode: 'insensitive' } },
      { fullNameAr: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } },
    ];
  }

  const supervisors = await prisma.user.findMany({
    where: supWhere,
    orderBy: [{ fullName: 'asc' }],
    select: USER_SELECT,
  });

  const supervisorIds = supervisors.map((s) => s.id);
  if (supervisorIds.length === 0) return [];

  const empWhere = {
    isDeleted: false,
    isSuperAdmin: false,
    userType: 'Company',
    supervisorId: { in: supervisorIds },
  };
  if (!includeInactive) empWhere.isActive = true;
  if (term) {
    // When searching, include employees matching term even if supervisor matched by other fields.
    empWhere.OR = [
      { fullName: { contains: term, mode: 'insensitive' } },
      { fullNameAr: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } },
    ];
  }

  const employees = await prisma.user.findMany({
    where: empWhere,
    orderBy: [{ fullName: 'asc' }],
    select: USER_SELECT,
  });

  const bySupervisor = new Map();
  for (const e of employees) {
    if (!e.supervisorId) continue;
    if (!bySupervisor.has(e.supervisorId)) bySupervisor.set(e.supervisorId, []);
    bySupervisor.get(e.supervisorId).push(e);
  }

  return supervisors.map((s) => ({
    ...s,
    employees: bySupervisor.get(s.id) || [],
    employeesCount: (bySupervisor.get(s.id) || []).length,
  }));
}

async function getMyEmployees(supervisorId, options = {}) {
  const { q, includeInactive = true } = options;
  const where = {
    isDeleted: false,
    isSuperAdmin: false,
    userType: 'Company',
    supervisorId,
  };
  if (!includeInactive) where.isActive = true;
  if (q && String(q).trim() !== '') {
    const term = String(q).trim();
    where.OR = [
      { fullName: { contains: term, mode: 'insensitive' } },
      { fullNameAr: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } },
    ];
  }

  const employees = await prisma.user.findMany({
    where,
    orderBy: [{ fullName: 'asc' }],
    select: USER_SELECT,
  });

  return { data: employees, total: employees.length };
}

async function setUserAccessGrants(userIds, codes) {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  const uniqueCodes = [...new Set((codes || []).filter(Boolean))];
  if (uniqueUserIds.length === 0) return { updated: 0 };

  // Replace all grants for these users (simple + deterministic)
  await prisma.accessGrant.deleteMany({
    where: { userId: { in: uniqueUserIds } },
  });

  if (uniqueCodes.length > 0) {
    await prisma.accessGrant.createMany({
      data: uniqueUserIds.flatMap((userId) => uniqueCodes.map((code) => ({ userId, code }))),
      skipDuplicates: true,
    });
  }

  return { updated: uniqueUserIds.length, codes: uniqueCodes };
}

async function getUserAccessGrants(userId) {
  const rows = await prisma.accessGrant.findMany({
    where: { userId },
    select: { code: true },
    orderBy: { code: 'asc' },
  });
  return rows.map((r) => r.code);
}

async function resetPassword(id, newPassword) {
  const user = await prisma.user.findFirst({ where: { id, isDeleted: false } });
  if (!user) return null;
  if (user.isSuperAdmin) {
    const err = new Error('Super admin password cannot be reset here');
    err.code = 'SUPER_ADMIN_PROTECTED';
    throw err;
  }
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await authService.hashPassword(newPassword) },
  });
  return { success: true };
}

async function getUserById(id) {
  const user = await prisma.user.findFirst({
    where: { id, isDeleted: false },
    select: {
      ...USER_SELECT,
      supervisor: { select: { id: true, fullName: true, fullNameAr: true, email: true, role: true } },
    },
  });
  if (!user) return null;
  return authService.sanitizeUser(user);
}

async function createUser(data) {
  const passwordHash = await authService.hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      fullName: data.fullName.trim(),
      fullNameAr: data.fullNameAr?.trim() || null,
      email: data.email.trim().toLowerCase(),
      passwordHash,
      phone: data.phone?.trim() || null,
      userType: data.userType,
      role: data.role || 'EmpRead',
      jobTitle: data.jobTitle?.trim() || null,
      shiftId: data.shiftId || null,
      locationId: data.locationId || null,
      supervisorId: data.supervisorId || null,
      serviceCenterId: data.serviceCenterId || null,
      isActive: data.isActive !== false,
      isHr: data.isHr === true,
    },
  });
  return authService.sanitizeUser(user);
}

async function registerEmployee(data) {
  return createUser({
    ...data,
    userType: 'Company',
    role: 'EmpRead',
    locationId: data.locationId,
    shiftId: data.shiftId,
    supervisorId: data.supervisorId || null,
    serviceCenterId: null,
  });
}

async function registerServiceCenter(data) {
  return createUser({
    ...data,
    userType: 'ServiceCenter',
    role: 'Supervisor',
    locationId: null,
    shiftId: null,
    supervisorId: null,
    serviceCenterId: data.serviceCenterId || null,
  });
}

async function updateUser(id, data) {
  const existing = await prisma.user.findFirst({ where: { id, isDeleted: false } });
  if (!existing) return null;

  const payload = {};
  if (data.fullName !== undefined) payload.fullName = data.fullName.trim();
  if (data.fullNameAr !== undefined) payload.fullNameAr = data.fullNameAr?.trim() || null;
  if (data.email !== undefined) payload.email = data.email.trim().toLowerCase();
  if (data.phone !== undefined) payload.phone = data.phone?.trim() || null;
  if (data.userType !== undefined) payload.userType = data.userType;
  if (data.role !== undefined) payload.role = data.role;
  if (data.jobTitle !== undefined) payload.jobTitle = data.jobTitle?.trim() || null;
  if (data.shiftId !== undefined) payload.shiftId = data.shiftId || null;
  if (data.locationId !== undefined) payload.locationId = data.locationId || null;
  if (data.supervisorId !== undefined) payload.supervisorId = data.supervisorId || null;
  if (data.serviceCenterId !== undefined) payload.serviceCenterId = data.serviceCenterId || null;
  if (data.isActive !== undefined) payload.isActive = data.isActive;
  if (data.isHr !== undefined) payload.isHr = data.isHr;

  const updated = await prisma.user.update({ where: { id }, data: payload });
  return authService.sanitizeUser(updated);
}

async function softDeleteUser(id) {
  const user = await prisma.user.findFirst({ where: { id, isDeleted: false } });
  if (!user) return null;
  if (user.isSuperAdmin && SUPER_ADMIN_EMAIL && String(user.email).toLowerCase() === String(SUPER_ADMIN_EMAIL).trim().toLowerCase()) {
    const err = new Error('Super admin cannot be deleted');
    err.code = 'SUPER_ADMIN_PROTECTED';
    throw err;
  }
  const updated = await prisma.user.update({
    where: { id },
    data: { isDeleted: true, isActive: false },
  });
  return authService.sanitizeUser(updated);
}

async function changePassword(id, currentPassword, newPassword) {
  const user = await prisma.user.findFirst({ where: { id, isDeleted: false } });
  if (!user) return null;
  const valid = await authService.comparePassword(currentPassword, user.passwordHash);
  if (!valid) {
    const err = new Error('Current password is incorrect');
    err.code = 'INVALID_PASSWORD';
    throw err;
  }
  await prisma.user.update({ where: { id }, data: { passwordHash: await authService.hashPassword(newPassword) } });
  return { success: true };
}

async function bumpTokenVersion(id) {
  const updated = await prisma.user.update({
    where: { id },
    data: { tokenVersion: { increment: 1 } },
    select: { id: true, tokenVersion: true },
  });
  return updated;
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
  resetPassword,
  setUserAccessGrants,
  getUserAccessGrants,
  bulkAssignSupervisor,
  getSupervisorsTree,
  getMyEmployees,
  bumpTokenVersion,
};
