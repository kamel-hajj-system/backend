const serviceCenterService = require('../services/serviceCenterService');
const pilgrimNationalityService = require('../services/pilgrimNationalityService');
const pilgrimCompanyService = require('../services/pilgrimCompanyService');

function validationError(res, err) {
  return res.status(400).json({
    error: err.message,
    code: err.code,
    details: err.details,
  });
}

const SERVICE_CENTER_BUSINESS_CODES = new Set([
  'CAPACITY_EXCEEDED',
  'DUPLICATE_PILGRIM_COMPANY_IN_CENTER',
]);

const PILGRIM_NATIONALITY_BUSINESS_CODES = new Set([]);

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
    if (err.code === 'INVALID_PILGRIM_COMPANY' || err.code === 'CODE_REQUIRED') {
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
    if (err.code === 'INVALID_PILGRIM_COMPANY' || err.code === 'CODE_REQUIRED') {
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

/** Reception: read-only pilgrim companies overview. */
async function listReceptionPilgrimCompaniesOverview(req, res, next) {
  try {
    const rows = await serviceCenterService.listForReceptionPilgrimCompaniesOverview();
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

/** Reception: read-only pilgrim nationalities overview. */
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

async function getNationality(req, res, next) {
  try {
    const row = await pilgrimNationalityService.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Nationality not found' });
    return res.json(row);
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

// ——— Pilgrim companies ———

async function listPilgrimCompanies(req, res, next) {
  try {
    const rows = await pilgrimCompanyService.list();
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getPilgrimCompany(req, res, next) {
  try {
    const row = await pilgrimCompanyService.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Pilgrim company not found' });
    return res.json(row);
  } catch (err) {
    next(err);
  }
}

async function createPilgrimCompany(req, res, next) {
  try {
    const row = await pilgrimCompanyService.create(req.body);
    return res.status(201).json(row);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'External code must be unique' });
    }
    if (err.code === 'INVALID_NATIONALITY' || err.code === 'REQUIRED_FIELDS') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function updatePilgrimCompany(req, res, next) {
  try {
    const row = await pilgrimCompanyService.update(req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Pilgrim company not found' });
    return res.json(row);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'External code must be unique' });
    }
    if (err.code === 'INVALID_NATIONALITY' || err.code === 'REQUIRED_FIELDS') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function deletePilgrimCompany(req, res, next) {
  try {
    const ok = await pilgrimCompanyService.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Pilgrim company not found' });
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
  listReceptionPilgrimCompaniesOverview,
  listReceptionNationalitiesOverview,
  listNationalities,
  getNationality,
  createNationality,
  updateNationality,
  deleteNationality,
  listPilgrimCompanies,
  getPilgrimCompany,
  createPilgrimCompany,
  updatePilgrimCompany,
  deletePilgrimCompany,
};
