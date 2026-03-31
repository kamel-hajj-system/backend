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

/**
 * Company users this account may treat as "team": direct reports ∪ Super Admin delegated visibility.
 */
async function getCompanyTeamUserIds(viewerId) {
  const [delegatedRows, directEmployees] = await Promise.all([
    prisma.delegatedEmployeeVisibility.findMany({
      where: { viewerId },
      select: { visibleUserId: true },
    }),
    prisma.user.findMany({
      where: {
        supervisorId: viewerId,
        isDeleted: false,
        isSuperAdmin: false,
        userType: 'Company',
      },
      select: { id: true },
    }),
  ]);
  const set = new Set();
  for (const d of delegatedRows) set.add(d.visibleUserId);
  for (const d of directEmployees) set.add(d.id);
  return [...set];
}

async function getMyEmployees(supervisorId, options = {}) {
  const { q, includeInactive = true } = options;
  const teamIds = await getCompanyTeamUserIds(supervisorId);
  if (teamIds.length === 0) {
    return { data: [], total: 0 };
  }

  const where = {
    isDeleted: false,
    isSuperAdmin: false,
    userType: 'Company',
    id: { in: teamIds },
  };
  if (!includeInactive) where.isActive = true;
  if (q && String(q).trim() !== '') {
    const term = String(q).trim();
    where.AND = [
      {
        OR: [
          { fullName: { contains: term, mode: 'insensitive' } },
          { fullNameAr: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const employees = await prisma.user.findMany({
    where,
    orderBy: [{ fullName: 'asc' }],
    select: USER_SELECT,
  });

  return { data: employees, total: employees.length };
}

/**
 * Supervisor updates role for a direct report only (same scope as getMyEmployees).
 */
async function updateMyEmployeeRole(supervisorId, employeeId, role) {
  const validRoles = ['EmpRead', 'EmpManage'];
  if (!validRoles.includes(role)) {
    const err = new Error('Invalid role');
    err.code = 'INVALID_ROLE';
    throw err;
  }
  const employee = await prisma.user.findFirst({
    where: {
      id: employeeId,
      isDeleted: false,
      isSuperAdmin: false,
      userType: 'Company',
      supervisorId,
    },
  });
  if (!employee) {
    const err = new Error('Employee not found or not in your team');
    err.code = 'NOT_FOUND';
    throw err;
  }
  await prisma.user.update({
    where: { id: employeeId },
    data: { role },
  });
  return getUserById(employeeId);
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

async function applyDefaultAccessGrantsForApprovedUser(userId, userType) {
  const {
    DEFAULT_PERMISSIONS_COMPANY,
    DEFAULT_PERMISSIONS_SERVICE_CENTER,
  } = require('../../permissions/constants');
  const codes =
    userType === 'ServiceCenter'
      ? [...DEFAULT_PERMISSIONS_SERVICE_CENTER]
      : [...DEFAULT_PERMISSIONS_COMPANY];
  if (codes.length) await setUserAccessGrants([userId], codes);
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
      /** false = pending HR (public sign-up) or explicitly inactive; default true for admin-created users */
      isActive: data.isActive !== false,
      isHr: data.isHr === true,
    },
  });
  return authService.sanitizeUser(user);
}

/**
 * Public sign-up: supervisors at a work location (active Company role Supervisor).
 */
async function listSupervisorsForEmployeeSignup(locationId) {
  if (!locationId || typeof locationId !== 'string') return [];
  return prisma.user.findMany({
    where: {
      isDeleted: false,
      isActive: true,
      isSuperAdmin: false,
      userType: 'Company',
      role: 'Supervisor',
      locationId,
    },
    orderBy: [{ fullName: 'asc' }],
    select: { id: true, fullName: true, fullNameAr: true, email: true },
  });
}

async function registerEmployee(data) {
  if (data.supervisorId) {
    const sup = await prisma.user.findFirst({
      where: {
        id: data.supervisorId,
        isDeleted: false,
        isActive: true,
        userType: 'Company',
        role: 'Supervisor',
        locationId: data.locationId,
      },
      select: { id: true },
    });
    if (!sup) {
      const err = new Error('Invalid supervisor for the selected location');
      err.code = 'INVALID_SUPERVISOR';
      throw err;
    }
  }
  if (data.shiftId && data.locationId) {
    const shift = await prisma.shift.findUnique({
      where: { id: data.shiftId },
      select: { id: true, locationId: true, isForEmployee: true },
    });
    if (!shift || !shift.isForEmployee) {
      const err = new Error('Invalid shift');
      err.code = 'INVALID_SHIFT';
      throw err;
    }
    if (shift.locationId != null && shift.locationId !== data.locationId) {
      const err = new Error('Shift does not match selected work location');
      err.code = 'INVALID_SHIFT_FOR_LOCATION';
      throw err;
    }
  }
  return createUser({
    ...data,
    userType: 'Company',
    role: 'EmpRead',
    isActive: false,
    locationId: data.locationId,
    shiftId: data.shiftId,
    supervisorId: data.supervisorId || null,
    serviceCenterId: null,
  });
}

async function registerServiceCenter(data) {
  const centerId = data.serviceCenterId?.trim();
  if (!centerId) {
    const err = new Error('Service center is required');
    err.code = 'SERVICE_CENTER_REQUIRED';
    throw err;
  }
  const center = await prisma.serviceCenter.findUnique({
    where: { id: centerId },
    select: { id: true },
  });
  if (!center) {
    const err = new Error('Unknown or invalid service center');
    err.code = 'INVALID_SERVICE_CENTER';
    throw err;
  }
  return createUser({
    ...data,
    userType: 'ServiceCenter',
    role: 'EmpRead',
    isActive: false,
    locationId: null,
    shiftId: null,
    supervisorId: null,
    serviceCenterId: center.id,
  });
}

/**
 * Pending self-service registrations for HR (Company → all Company pending; ServiceCenter → same center only).
 */
async function listPendingRegistrations(hrUser) {
  const where = {
    isDeleted: false,
    isActive: false,
    isSuperAdmin: false,
  };
  if (hrUser.userType === 'Company') {
    where.userType = 'Company';
  } else if (hrUser.userType === 'ServiceCenter') {
    where.userType = 'ServiceCenter';
    where.serviceCenterId = hrUser.serviceCenterId;
  } else {
    return [];
  }
  return prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      ...USER_SELECT,
      serviceCenter: { select: { id: true, code: true, name: true, nameAr: true } },
    },
  });
}

/**
 * Approve a pending user: set role, allow login, apply default portal access grants.
 */
async function approvePendingUser(actor, targetId, role) {
  const validRoles = ['Supervisor', 'EmpRead', 'EmpManage'];
  if (!validRoles.includes(role)) {
    const err = new Error('Invalid role');
    err.code = 'INVALID_ROLE';
    throw err;
  }
  const target = await prisma.user.findFirst({
    where: { id: targetId, isDeleted: false },
  });
  if (!target) {
    const err = new Error('User not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (target.isActive) {
    const err = new Error('User is already active');
    err.code = 'ALREADY_APPROVED';
    throw err;
  }
  if (actor.userType === 'Company') {
    if (target.userType !== 'Company') {
      const err = new Error('Not in scope');
      err.code = 'OUT_OF_SCOPE';
      throw err;
    }
  } else if (actor.userType === 'ServiceCenter') {
    if (target.userType !== 'ServiceCenter' || target.serviceCenterId !== actor.serviceCenterId) {
      const err = new Error('Not in scope');
      err.code = 'OUT_OF_SCOPE';
      throw err;
    }
  } else {
    const err = new Error('Not in scope');
    err.code = 'OUT_OF_SCOPE';
    throw err;
  }

  await prisma.user.update({
    where: { id: targetId },
    data: { isActive: true, role },
  });
  await applyDefaultAccessGrantsForApprovedUser(targetId, target.userType);
  return getUserById(targetId);
}

/**
 * Pending company users who selected this supervisor at sign-up (supervisorId = supervisor's id).
 */
async function listPendingRegistrationsForSupervisor(supervisorId) {
  return prisma.user.findMany({
    where: {
      isDeleted: false,
      isActive: false,
      isSuperAdmin: false,
      userType: 'Company',
      supervisorId,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      ...USER_SELECT,
    },
  });
}

/**
 * Supervisor approves only a direct report (same rules as HR approve, scoped by supervisorId).
 */
async function approvePendingUserForSupervisor(actor, targetId, role) {
  if (actor.userType !== 'Company' || actor.role !== 'Supervisor') {
    const err = new Error('Supervisor access required');
    err.code = 'FORBIDDEN';
    throw err;
  }
  const validRoles = ['EmpRead', 'EmpManage'];
  if (!validRoles.includes(role)) {
    const err = new Error('Invalid role');
    err.code = 'INVALID_ROLE';
    throw err;
  }
  const target = await prisma.user.findFirst({
    where: { id: targetId, isDeleted: false },
  });
  if (!target) {
    const err = new Error('User not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (target.isActive) {
    const err = new Error('User is already active');
    err.code = 'ALREADY_APPROVED';
    throw err;
  }
  if (target.userType !== 'Company' || target.supervisorId !== actor.id) {
    const err = new Error('Not in scope');
    err.code = 'OUT_OF_SCOPE';
    throw err;
  }

  await prisma.user.update({
    where: { id: targetId },
    data: { isActive: true, role },
  });
  await applyDefaultAccessGrantsForApprovedUser(targetId, target.userType);
  return getUserById(targetId);
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

const COMPANY_NON_ADMIN_WHERE = {
  isDeleted: false,
  isSuperAdmin: false,
  userType: 'Company',
};

/**
 * List delegated visibility grants grouped by viewer (Super Admin).
 */
async function listDelegatedVisibilityGrouped() {
  const rows = await prisma.delegatedEmployeeVisibility.findMany({
    orderBy: [{ viewerId: 'asc' }, { visibleUserId: 'asc' }],
    include: {
      viewer: { select: USER_SELECT },
      visibleUser: { select: USER_SELECT },
    },
  });
  const byViewer = new Map();
  for (const row of rows) {
    if (!byViewer.has(row.viewerId)) {
      byViewer.set(row.viewerId, { viewer: row.viewer, visibleUsers: [] });
    }
    byViewer.get(row.viewerId).visibleUsers.push(row.visibleUser);
  }
  return { data: [...byViewer.values()] };
}

/**
 * Replace the full visible-user set for one viewer. viewer and all targets must be active Company users (not super admin).
 */
async function setDelegatedVisibilityForViewer(viewerId, visibleUserIdsRaw) {
  const visibleUserIds = [...new Set((visibleUserIdsRaw || []).filter(Boolean))].filter((id) => id !== viewerId);

  const viewer = await prisma.user.findFirst({
    where: { id: viewerId, ...COMPANY_NON_ADMIN_WHERE },
    select: { id: true },
  });
  if (!viewer) {
    const err = new Error('Viewer not found or not a valid company user');
    err.code = 'INVALID_VIEWER';
    throw err;
  }

  if (visibleUserIds.length === 0) {
    await prisma.delegatedEmployeeVisibility.deleteMany({ where: { viewerId } });
    return { viewerId, visibleUserIds: [], updated: 0 };
  }

  const targets = await prisma.user.findMany({
    where: {
      id: { in: visibleUserIds },
      ...COMPANY_NON_ADMIN_WHERE,
    },
    select: { id: true },
  });
  if (targets.length !== visibleUserIds.length) {
    const err = new Error('One or more visible users are invalid or not company users');
    err.code = 'INVALID_VISIBLE_USERS';
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    await tx.delegatedEmployeeVisibility.deleteMany({ where: { viewerId } });
    await tx.delegatedEmployeeVisibility.createMany({
      data: visibleUserIds.map((visibleUserId) => ({ viewerId, visibleUserId })),
      skipDuplicates: true,
    });
  });

  return { viewerId, visibleUserIds, updated: visibleUserIds.length };
}

module.exports = {
  getUsers,
  getUserById,
  createUser,
  registerEmployee,
  listSupervisorsForEmployeeSignup,
  registerServiceCenter,
  listPendingRegistrations,
  approvePendingUser,
  listPendingRegistrationsForSupervisor,
  approvePendingUserForSupervisor,
  updateUser,
  softDeleteUser,
  changePassword,
  resetPassword,
  setUserAccessGrants,
  getUserAccessGrants,
  bulkAssignSupervisor,
  getSupervisorsTree,
  getMyEmployees,
  updateMyEmployeeRole,
  bumpTokenVersion,
  listDelegatedVisibilityGrouped,
  setDelegatedVisibilityForViewer,
  getCompanyTeamUserIds,
};
