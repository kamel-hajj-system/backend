const locationService = require('../services/locationService');

async function list(req, res, next) {
  try {
    const isActive = req.query.isActive;
    const options = {};
    if (isActive !== undefined) {
      options.isActive = isActive === 'true' || isActive === true;
    }
    const locations = await locationService.getLocations(options);
    return res.json(locations);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const location = await locationService.getLocationById(req.params.id);
    if (!location) return res.status(404).json({ error: 'Location not found' });
    return res.json(location);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const location = await locationService.createLocation(req.body);
    return res.status(201).json(location);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const location = await locationService.updateLocation(req.params.id, req.body);
    if (!location) return res.status(404).json({ error: 'Location not found' });
    return res.json(location);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
};
