const prisma = require('./prisma');
const {
  UserType,
  Role,
  AuditAction,
  ActivityAction,
  SUPER_ADMIN_EMAIL,
  ENTITY_USER,
} = require('./constants');

module.exports = {
  prisma,
  UserType,
  Role,
  AuditAction,
  ActivityAction,
  SUPER_ADMIN_EMAIL,
  ENTITY_USER,
};
