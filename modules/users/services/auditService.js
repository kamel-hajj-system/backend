const { prisma } = require('../models');

/**
 * Create an audit log entry.
 * @param {Object} data - { userId?, action, entityType, entityId?, beforeValue?, afterValue? }
 */
async function createAuditLog(data) {
  return prisma.auditLog.create({
    data: {
      userId: data.userId ?? null,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      beforeValue: data.beforeValue ?? undefined,
      afterValue: data.afterValue ?? undefined,
    },
  });
}

module.exports = {
  createAuditLog,
};
