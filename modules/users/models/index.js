const prisma = require('./prisma');
const {
  UserType,
  Role,
  SUPER_ADMIN_EMAIL,
} = require('./constants');

module.exports = {
  prisma,
  UserType,
  Role,
  SUPER_ADMIN_EMAIL,
};
