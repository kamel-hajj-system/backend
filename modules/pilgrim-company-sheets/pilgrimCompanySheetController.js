const {
  listAll,
  createSheet,
  updateSheet,
  deleteSheet,
  getPreviewForSource,
  getPilgrimCompanyDataOverview,
  applyFieldFromPilgrimSheetToNusuk,
  applyAllEmptyFieldsFromPilgrimSheetToNusuk,
  MAX_SHEETS,
} = require('./pilgrimCompanySheetService');
const { logNusukRowUpdatedAudit } = require('../nusuk/nusukAuditHelper');

async function list(req, res) {
  try {
    const rows = await listAll();
    res.json({ data: rows, maxSheets: MAX_SHEETS });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Failed to list' });
  }
}

async function create(req, res) {
  try {
    const row = await createSheet(req.body || {});
    res.status(201).json({ data: row });
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ message: e.message || 'Failed to create' });
  }
}

async function update(req, res) {
  try {
    const row = await updateSheet(req.params.id, req.body || {});
    res.json({ data: row });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ message: 'Not found' });
    const code = e.statusCode || 500;
    res.status(code).json({ message: e.message || 'Failed to update' });
  }
}

async function remove(req, res) {
  try {
    await deleteSheet(req.params.id);
    res.status(204).send();
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ message: 'Not found' });
    res.status(500).json({ message: e.message || 'Failed to delete' });
  }
}

async function preview(req, res) {
  try {
    const payload = await getPreviewForSource(req.params.id);
    if (!payload) return res.status(404).json({ message: 'Not found' });
    res.json(payload);
  } catch (e) {
    res.status(500).json({ message: e.message || 'Failed to load preview' });
  }
}

async function dataOverview(req, res) {
  try {
    const payload = await getPilgrimCompanyDataOverview();
    res.json(payload);
  } catch (e) {
    res.status(500).json({ message: e.message || 'Failed to load overview' });
  }
}

async function applyFieldToNusuk(req, res) {
  try {
    const { nusukRowId, fieldKey, overwrite } = req.body || {};
    const data = await applyFieldFromPilgrimSheetToNusuk(req.params.id, {
      nusukRowId,
      fieldKey,
      overwrite: Boolean(overwrite),
    });
    void logNusukRowUpdatedAudit(req, data, { source: 'pilgrim_sheet_field' });
    res.json({ data });
  } catch (e) {
    const code = e.statusCode || 500;
    if (code === 404) {
      return res.status(404).json({ message: e.message || 'Not found', code: e.code });
    }
    if (code === 400 || code === 409 || code === 502) {
      return res.status(code).json({ message: e.message || 'Request failed', code: e.code });
    }
    res.status(500).json({ message: e.message || 'Failed to apply field' });
  }
}

async function applyAllEmptyFieldsToNusuk(req, res) {
  try {
    const { nusukRowId, includeOverwrite } = req.body || {};
    const data = await applyAllEmptyFieldsFromPilgrimSheetToNusuk(req.params.id, {
      nusukRowId,
      includeOverwrite: Boolean(includeOverwrite),
    });
    void logNusukRowUpdatedAudit(req, data, { source: 'pilgrim_sheet_merge' });
    res.json({ data });
  } catch (e) {
    const code = e.statusCode || 500;
    if (code === 404) {
      return res.status(404).json({ message: e.message || 'Not found', code: e.code });
    }
    if (code === 400 || code === 409 || code === 502) {
      return res.status(code).json({ message: e.message || 'Request failed', code: e.code });
    }
    res.status(500).json({ message: e.message || 'Failed to apply fields' });
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  preview,
  dataOverview,
  applyFieldToNusuk,
  applyAllEmptyFieldsToNusuk,
};
