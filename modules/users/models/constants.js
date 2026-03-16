/**
 * User module constants and enums (aligned with Prisma schema).
 */
const UserType = Object.freeze({
  Company: 'Company',
  ServiceCenter: 'ServiceCenter',
});

const Role = Object.freeze({
  Admin: 'Admin',
  Supervisor: 'Supervisor',
  Employee: 'Employee',
});

const AuditAction = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ROLE_ASSIGN: 'ROLE_ASSIGN',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PERMISSION_ASSIGN: 'PERMISSION_ASSIGN',
});

const ActivityAction = Object.freeze({
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
});

/**
 * Super admin email. Must be set via SUPER_ADMIN_EMAIL in production.
 * In development (NODE_ENV !== 'production') defaults to 'superadmin' if unset.
 */
const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL ??
  (process.env.NODE_ENV === 'production' ? '' : 'superadmin');

const ENTITY_USER = 'User';

module.exports = {
  UserType,
  Role,
  AuditAction,
  ActivityAction,
  SUPER_ADMIN_EMAIL,
  ENTITY_USER,
};
