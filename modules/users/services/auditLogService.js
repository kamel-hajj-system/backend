const { prisma } = require('../models');

function getClientIp(req) {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string' && xfwd.trim() !== '') return xfwd.split(',')[0].trim();
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim() !== '') return realIp.trim();
  return req.ip;
}

async function logAudit({ req, userId, action, entity, entityId, meta }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entity: entity || null,
        entityId: entityId ? String(entityId) : null,
        ip: req ? getClientIp(req) : null,
        meta: meta ?? undefined,
      },
    });
  } catch {
    // Never block request on audit failure.
  }
}

module.exports = {
  logAudit,
};

