const serviceCenterService = require('../services/serviceCenterService');
const pilgrimNationalityService = require('../services/pilgrimNationalityService');

function validationError(res, err) {
  return res.status(400).json({
    error: err.message,
    code: err.code,
    details: err.details,
  });
}

const SERVICE_CENTER_BUSINESS_CODES = new Set([
  'CAPACITY_EXCEEDED',
  'DUPLICATE_NATIONALITY_IN_CENTER',
  'ARRIVING_EXCEEDS_ALLOCATED_ROW',
  'NATIONALITY_ALLOCATION_EXCEEDED',
]);

const PILGRIM_NATIONALITY_BUSINESS_CODES = new Set([
  'TOTAL_ARRIVING_EXCEEDS_TOTAL_PILGRIMS',
  'NATIONALITY_TOTAL_BELOW_ALLOCATED',
]);

// ——— Service centers ———

/** Public list for service-center signup (no auth). */
async function listPublicCatalog(req, res, next) {
  try {
    const rows = await serviceCenterService.listPublicCatalog();
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function listCenters(req, res, next) {
  try {
    const rows = await serviceCenterService.list();
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getCenter(req, res, next) {
  try {
    const row = await serviceCenterService.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Service center not found' });
    return res.json(row);
  } catch (err) {
    next(err);
  }
}

async function createCenter(req, res, next) {
  try {
    const row = await serviceCenterService.create(req.body);
    return res.status(201).json(row);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'This center code is already in use' });
    }
    if (err.code === 'INVALID_NATIONALITY' || err.code === 'CODE_REQUIRED') {
      return res.status(400).json({ error: err.message });
    }
    if (SERVICE_CENTER_BUSINESS_CODES.has(err.code)) {
      return validationError(res, err);
    }
    next(err);
  }
}

async function updateCenter(req, res, next) {
  try {
    const row = await serviceCenterService.update(req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Service center not found' });
    return res.json(row);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'This center code is already in use' });
    }
    if (err.code === 'INVALID_NATIONALITY' || err.code === 'CODE_REQUIRED') {
      return res.status(400).json({ error: err.message });
    }
    if (SERVICE_CENTER_BUSINESS_CODES.has(err.code)) {
      return validationError(res, err);
    }
    next(err);
  }
}

async function deleteCenter(req, res, next) {
  try {
    const ok = await serviceCenterService.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Service center not found' });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function listCenterUsers(req, res, next) {
  try {
    const center = await serviceCenterService.getById(req.params.id);
    if (!center) return res.status(404).json({ error: 'Service center not found' });
    const users = await serviceCenterService.listUsersForCenter(req.params.id);
    return res.json(users);
  } catch (err) {
    next(err);
  }
}

/** Reception: read-only overview for dashboard (requires reception.dashboard). */
async function listReceptionOverview(req, res, next) {
  try {
    const rows = await serviceCenterService.listForReceptionOverview();
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

/** Reception: users at center — name & phone only (requires reception.dashboard). */
async function listReceptionCenterUsers(req, res, next) {
  try {
    const center = await serviceCenterService.getById(req.params.id);
    if (!center) return res.status(404).json({ error: 'Service center not found' });
    const users = await serviceCenterService.listUsersForCenter(req.params.id);
    const slim = users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      fullNameAr: u.fullNameAr,
      phone: u.phone,
    }));
    return res.json(slim);
  } catch (err) {
    next(err);
  }
}

/** Reception: nationalities with totals across all centers (read-only). */
async function listReceptionNationalitiesOverview(req, res, next) {
  try {
    const rows = await serviceCenterService.listForReceptionNationalitiesOverview();
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ——— Pilgrim nationalities (reference) ———

async function listNationalities(req, res, next) {
  try {
    const rows = await pilgrimNationalityService.list();
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function syncAllNationalityArrivingTotals(req, res, next) {
  try {
    const result = await pilgrimNationalityService.syncAllArrivingTotalsFromLinks();
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getNationality(req, res, next) {
  try {
    const row = await pilgrimNationalityService.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Nationality not found' });
    return res.json(row);
  } catch (err) {
    next(err);
  }
}

async function getNationalityOverview(req, res, next) {
  try {
    const overview = await pilgrimNationalityService.getOverview(req.params.id);
    if (!overview) return res.status(404).json({ error: 'Nationality not found' });
    return res.json(overview);
  } catch (err) {
    next(err);
  }
}

async function createNationality(req, res, next) {
  try {
    const row = await pilgrimNationalityService.create(req.body);
    return res.status(201).json(row);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Nationality code must be unique' });
    }
    if (PILGRIM_NATIONALITY_BUSINESS_CODES.has(err.code)) {
      return validationError(res, err);
    }
    next(err);
  }
}

async function updateNationality(req, res, next) {
  try {
    const row = await pilgrimNationalityService.update(req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Nationality not found' });
    return res.json(row);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Nationality code must be unique' });
    }
    if (PILGRIM_NATIONALITY_BUSINESS_CODES.has(err.code)) {
      return validationError(res, err);
    }
    next(err);
  }
}

async function deleteNationality(req, res, next) {
  try {
    const ok = await pilgrimNationalityService.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Nationality not found' });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPublicCatalog,
  listCenters,
  getCenter,
  createCenter,
  updateCenter,
  deleteCenter,
  listCenterUsers,
  listReceptionOverview,
  listReceptionCenterUsers,
  listReceptionNationalitiesOverview,
  listNationalities,
  syncAllNationalityArrivingTotals,
  getNationality,
  getNationalityOverview,
  createNationality,
  updateNationality,
  deleteNationality,
};
