const { prisma } = require('../users/models');

const ACTION = 'nusuk.row.updated';
const ENTITY = 'NusukSheetRow';

function mapMeta(log) {
  const meta = log.meta && typeof log.meta === 'object' ? log.meta : {};
  const snap = meta.snapshot && typeof meta.snapshot === 'object' ? meta.snapshot : {};
  return { meta, snap };
}

async function listNusukInputMonitoringLogs({ page = 1, pageSize = 20 } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(100, Math.max(5, Number(pageSize) || 20));
  const skip = (p - 1) * ps;

  const where = { action: ACTION, entity: ENTITY };

  const [total, logs, last24h, last7d] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: ps,
      include: {
        user: { select: { fullName: true, fullNameAr: true, email: true, userType: true } },
      },
    }),
    prisma.auditLog.count({
      where: {
        ...where,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.auditLog.count({
      where: {
        ...where,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const items = logs.map((log) => {
    const { meta, snap } = mapMeta(log);
    const fallbackName =
      log.user?.fullNameAr?.trim() ||
      log.user?.fullName?.trim() ||
      (log.user?.email ? String(log.user.email) : null);

    return {
      id: log.id,
      createdAt: log.createdAt,
      nusukRowId: log.entityId,
      source: meta.source || null,
      companyEditorName: meta.companyEditorName ?? null,
      serviceCenterEditorName: meta.serviceCenterEditorName ?? null,
      editorUserId: log.userId,
      editorFallbackName: fallbackName,
      preArrivalGroupNumber: snap.preArrivalGroupNumber ?? '',
      entityName: snap.entityName ?? '',
      pilgrimsCount: snap.pilgrimsCount ?? null,
      fieldsComplete: Boolean(snap.allComplete),
    };
  });

  return {
    page: p,
    pageSize: ps,
    total,
    summary: {
      totalEvents: total,
      last24Hours: last24h,
      last7Days: last7d,
    },
    items,
  };
}

module.exports = {
  listNusukInputMonitoringLogs,
};
