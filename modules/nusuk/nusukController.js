const nusukService = require('./nusukService');
const pilgrimCompanySheetService = require('../pilgrim-company-sheets/pilgrimCompanySheetService');
const { logNusukRowUpdatedAudit } = require('./nusukAuditHelper');
const nusukInputMonitoringService = require('./nusukInputMonitoringService');

async function sync(req, res, next) {
  try {
    const result = await nusukService.syncFromSheet({});
    return res.json(result);
  } catch (err) {
    if (err.code === 'NUSUK_SHEET_NOT_CONFIGURED') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    next(err);
  }
}

async function previewSync(req, res, next) {
  try {
    const result = await nusukService.previewSyncFromSheet({});
    return res.json(result);
  } catch (err) {
    if (err.code === 'NUSUK_SHEET_NOT_CONFIGURED') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    next(err);
  }
}

async function saveSync(req, res, next) {
  try {
    const { rows, sourceUrl, parsedFromSheet, skippedAlreadyPresent } = req.body || {};
    const result = await nusukService.saveSyncedRows({
      rows,
      sourceUrl,
      parsedFromSheet,
      skippedAlreadyPresent,
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await nusukService.listRows();
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listForServiceCenter(req, res, next) {
  try {
    const result = await nusukService.listRowsForServiceCenter(req.user.serviceCenterId);
    return res.json(result);
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

/** Service center home KPIs (allocated pilgrims, flight-confirmed sum, actual arrival, compare %). */
async function getServiceCenterDashboardSummary(req, res, next) {
  try {
    const payload = await nusukService.getServiceCenterDashboardSummary(req.user.serviceCenterId);
    return res.json(payload);
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

/** Service center home: pilgrims per «تاريخ القدوم» when arrival flight confirmed. */
async function getServiceCenterPreArrivalByArrivalDate(req, res, next) {
  try {
    const payload = await nusukService.getServiceCenterPreArrivalByArrivalDate(req.user.serviceCenterId);
    return res.json(payload);
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

async function getOneForServiceCenter(req, res, next) {
  try {
    const result = await nusukService.getRowForServiceCenter(req.user.serviceCenterId, req.params.id);
    if (!result) return res.status(404).json({ error: 'Row not found' });
    return res.json(result);
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message, code: err.code || 'FORBIDDEN' });
    }
    next(err);
  }
}

async function getColumnsConfig(req, res, next) {
  try {
    const cfg = await nusukService.getColumnsConfig();
    return res.json(cfg);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const {
      entityName,
      pilgrimsCount,
      rowData,
      expectedUpdatedAt,
      lockToken,
      arrivalFlightConfirmed,
      actualArrivalStatus,
      actualArrivalCount,
      serviceCenterNote,
    } = req.body || {};
    const row = await nusukService.updateRow(
      req.params.id,
      {
        entityName,
        pilgrimsCount: pilgrimsCount === undefined ? undefined : pilgrimsCount,
        rowData,
        expectedUpdatedAt,
        lockToken,
        arrivalFlightConfirmed,
        actualArrivalStatus,
        actualArrivalCount,
        serviceCenterNote,
      },
      { userId: req.userId }
    );
    if (!row) return res.status(404).json({ error: 'Row not found' });
    void logNusukRowUpdatedAudit(req, row, { source: 'reception' });
    return res.json(row);
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message, code: err.code || 'STALE_ROW' });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    if (err.statusCode === 400 && err.code === 'INVALID_ACTUAL_ARRIVAL_STATUS') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    if (err.statusCode === 400 && err.code === 'INVALID_ACTUAL_ARRIVAL_COUNT') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    next(err);
  }
}

async function updateServiceCenter(req, res, next) {
  try {
    const {
      entityName,
      pilgrimsCount,
      rowData,
      arrivalFlightConfirmed,
      actualArrivalStatus,
      actualArrivalCount,
      serviceCenterNote,
      expectedUpdatedAt,
    } = req.body || {};
    const row = await nusukService.updateServiceCenterNusukRow(req.params.id, req.user.serviceCenterId, {
      entityName,
      pilgrimsCount,
      rowData,
      arrivalFlightConfirmed,
      actualArrivalStatus,
      actualArrivalCount,
      serviceCenterNote,
      expectedUpdatedAt,
    });
    if (!row) return res.status(404).json({ error: 'Row not found' });
    void logNusukRowUpdatedAudit(req, row, { source: 'service_center' });
    return res.json(row);
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message, code: err.code || 'STALE_ROW' });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

async function acquireEditLock(req, res, next) {
  try {
    const result = await nusukService.acquireEditLock(req.params.id, req.userId);
    if (!result) return res.status(404).json({ error: 'Row not found' });
    return res.json(result);
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({
        error: err.message,
        code: err.code || 'ROW_LOCKED',
        lockedBy: err.lockedBy,
      });
    }
    next(err);
  }
}

async function releaseEditLock(req, res, next) {
  try {
    const { lockToken } = req.body || {};
    await nusukService.releaseEditLock(req.params.id, req.userId, lockToken);
    return res.json({ released: true });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    next(err);
  }
}

async function heartbeatEditLock(req, res, next) {
  try {
    const { lockToken } = req.body || {};
    const result = await nusukService.heartbeatEditLock(req.params.id, req.userId, lockToken);
    return res.json(result);
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message, code: err.code });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    next(err);
  }
}

/** Pilgrim company sheet row suggestions for the Nusuk edit modal (soft-fail JSON; always 200). */
async function getPilgrimSheetSuggestions(req, res, next) {
  try {
    const payload = await pilgrimCompanySheetService.getPilgrimSheetSuggestionsForNusukRow(req.params.id);
    return res.json(payload);
  } catch (err) {
    next(err);
  }
}

/** Summary stats for Reception Nusuk rows page (mission sheet totals vs Nusuk aggregate). */
async function getReceptionNusukRowsSummary(req, res, next) {
  try {
    const payload = await pilgrimCompanySheetService.getReceptionNusukRowsSummary();
    return res.json(payload);
  } catch (err) {
    next(err);
  }
}

/** Reception dashboard: scoped KPIs (`scope` query: pre_arrival | actual_arrival | all). */
async function getReceptionDashboardStats(req, res, next) {
  try {
    const scope = req.query.scope;
    const payload = await pilgrimCompanySheetService.getReceptionDashboardStats(scope);
    return res.json(payload);
  } catch (err) {
    next(err);
  }
}

/** Reception dashboard: port type & arrival port breakdowns from Nusuk `rowData` (scoped). */
async function getReceptionDashboardPortBreakdown(req, res, next) {
  try {
    const scope = req.query.scope;
    const payload = await pilgrimCompanySheetService.getReceptionDashboardPortBreakdown(scope);
    return res.json(payload);
  } catch (err) {
    next(err);
  }
}

/** Per-row mission sheet vs Nusuk compare flags (for table icons). */
async function getNusukSheetCompareFlags(req, res, next) {
  try {
    const payload = await pilgrimCompanySheetService.getNusukSheetCompareFlags();
    return res.json(payload);
  } catch (err) {
    next(err);
  }
}

/** Full column diff payload (same shape as pilgrim-sheet suggestions). */
async function getNusukSheetCompareDetail(req, res, next) {
  try {
    const payload = await pilgrimCompanySheetService.getPilgrimSheetSuggestionsForNusukRow(req.params.id);
    return res.json(payload);
  } catch (err) {
    next(err);
  }
}

/** Audit trail of in-app Nusuk row edits (who / when + row snapshot). */
async function listNusukInputMonitoring(req, res, next) {
  try {
    const page = req.query.page;
    const pageSize = req.query.pageSize;
    const payload = await nusukInputMonitoringService.listNusukInputMonitoringLogs({ page, pageSize });
    return res.json(payload);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sync,
  previewSync,
  saveSync,
  list,
  listForServiceCenter,
  getServiceCenterDashboardSummary,
  getServiceCenterPreArrivalByArrivalDate,
  getOneForServiceCenter,
  getColumnsConfig,
  update,
  updateServiceCenter,
  acquireEditLock,
  releaseEditLock,
  heartbeatEditLock,
  getPilgrimSheetSuggestions,
  getReceptionNusukRowsSummary,
  getReceptionDashboardStats,
  getReceptionDashboardPortBreakdown,
  getNusukSheetCompareFlags,
  getNusukSheetCompareDetail,
  listNusukInputMonitoring,
};
