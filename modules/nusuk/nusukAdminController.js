const nusukService = require('./nusukService');
const { logNusukRowUpdatedAudit } = require('./nusukAuditHelper');

async function getSettings(req, res, next) {
  try {
    const s = await nusukService.getAdminSettings();
    return res.json(s);
  } catch (err) {
    next(err);
  }
}

async function putSettings(req, res, next) {
  try {
    const { sheetCsvUrl, columnsConfig } = req.body || {};
    const s = await nusukService.updateAdminSettings({ sheetCsvUrl, columnsConfig });
    return res.json(s);
  } catch (err) {
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

async function putColumnsConfig(req, res, next) {
  try {
    const cfg = await nusukService.updateColumnsConfig(req.body || {});
    return res.json(cfg);
  } catch (err) {
    next(err);
  }
}

async function listSnapshots(req, res, next) {
  try {
    const rows = await nusukService.listSnapshots();
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function createSnapshot(req, res, next) {
  try {
    const { label } = req.body || {};
    const row = await nusukService.createManualSnapshot({ label });
    return res.status(201).json(row);
  } catch (err) {
    next(err);
  }
}

async function restoreSnapshot(req, res, next) {
  try {
    const result = await nusukService.restoreSnapshot(req.params.id);
    return res.json(result);
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'INVALID_SNAPSHOT') return res.status(400).json({ error: err.message });
    next(err);
  }
}

async function truncate(req, res, next) {
  try {
    const result = await nusukService.truncateAllRows();
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function sync(req, res, next) {
  try {
    const urlOverride = req.body?.url || undefined;
    const skipAutoSnapshot = Boolean(req.body?.skipAutoSnapshot);
    const result = await nusukService.syncFromSheet({ urlOverride, skipAutoSnapshot });
    return res.json(result);
  } catch (err) {
    if (err.code === 'NUSUK_SHEET_NOT_CONFIGURED') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    next(err);
  }
}

async function updateRow(req, res, next) {
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
    void logNusukRowUpdatedAudit(req, row, { source: 'admin' });
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
    next(err);
  }
}

module.exports = {
  getSettings,
  putSettings,
  getColumnsConfig,
  putColumnsConfig,
  listSnapshots,
  createSnapshot,
  restoreSnapshot,
  truncate,
  sync,
  updateRow,
};
