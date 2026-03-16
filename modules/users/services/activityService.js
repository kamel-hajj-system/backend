const { prisma } = require('../models');

/**
 * Log a user activity (e.g. login, logout).
 * @param {Object} data - { userId, action, ipAddress?, userAgent? }
 */
async function logActivity(data) {
  return prisma.activityLog.create({
    data: {
      userId: data.userId,
      action: data.action,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
    },
  });
}

module.exports = {
  logActivity,
};
