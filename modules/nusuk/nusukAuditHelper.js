const { logAudit } = require('../users/services/auditLogService');
const nusukService = require('./nusukService');
const {
  buildOrderedColumnKeysFromRow,
  computeNusukRowCompleteness,
} = require('./nusukCompletenessUtil');

function displayName(user) {
  if (!user) return null;
  const ar = user.fullNameAr && String(user.fullNameAr).trim();
  if (ar) return ar;
  const en = user.fullName && String(user.fullName).trim();
  if (en) return en;
  return user.email ? String(user.email).trim() : null;
}

/**
 * Logs one audit row per successful Nusuk save. Does not throw; failures are swallowed like `logAudit`.
 * @param {import('express').Request} req
 * @param {object} row - Enriched row from `nusukService` (same shape as API responses).
 * @param {{ source: string }} options
 */
async function logNusukRowUpdatedAudit(req, row, { source }) {
  try {
    if (!req || !row?.id) return;
    const u = req.user;
    if (!u) return;

    const name = displayName(u);
    let companyEditorName = null;
    let serviceCenterEditorName = null;

    if (u.userType === 'ServiceCenter') {
      serviceCenterEditorName = name;
    } else if (u.userType === 'Company' || u.isSuperAdmin === true) {
      companyEditorName = name;
    } else {
      companyEditorName = name;
    }

    const columnsConfig = await nusukService.getColumnsConfig();
    const orderedColumnKeys = buildOrderedColumnKeysFromRow(row, columnsConfig);
    const { allComplete } = computeNusukRowCompleteness(row, orderedColumnKeys, columnsConfig);

    const rd = row.rowData && typeof row.rowData === 'object' ? row.rowData : {};
    const preArrivalGroupNumber =
      rd.preArrivalGroupNumber != null && String(rd.preArrivalGroupNumber).trim() !== ''
        ? String(rd.preArrivalGroupNumber)
        : '';

    await logAudit({
      req,
      userId: req.userId,
      action: 'nusuk.row.updated',
      entity: 'NusukSheetRow',
      entityId: String(row.id),
      meta: {
        source: source || 'unknown',
        companyEditorName,
        serviceCenterEditorName,
        superAdmin: u.isSuperAdmin === true,
        snapshot: {
          preArrivalGroupNumber,
          entityName: row.entityName != null ? String(row.entityName) : '',
          pilgrimsCount: row.pilgrimsCount,
          allComplete,
        },
      },
    });
  } catch {
    // Never block callers
  }
}

module.exports = {
  logNusukRowUpdatedAudit,
};
