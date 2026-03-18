/**
 * User module constants and enums (aligned with Prisma schema).
 */
const UserType = Object.freeze({
  Company: 'Company',
  ServiceCenter: 'ServiceCenter',
  SuperAdmin: 'SuperAdmin',
});

const Role = Object.freeze({
  Supervisor: 'Supervisor',
  EmpRead: 'EmpRead',
  EmpManage: 'EmpManage',
});

const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL ??
  (process.env.NODE_ENV === 'production' ? '' : 'superadmin');

module.exports = {
  UserType,
  Role,
  SUPER_ADMIN_EMAIL,
};
