const shiftService = require('../services/shiftService');

async function list(req, res, next) {
  try {
    const isForEmployee = req.query.isForEmployee;
    const locationId = req.query.locationId;
    const options = {};
    if (isForEmployee !== undefined) {
      options.isForEmployee = isForEmployee === 'true' || isForEmployee === true;
    }
    if (locationId) options.locationId = locationId;
    const shifts = await shiftService.getShifts(options);
    return res.json(shifts);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const shift = await shiftService.getShiftById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    return res.json(shift);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const shift = await shiftService.createShift(req.body);
    return res.status(201).json(shift);
  } catch (err) {
    if (err.code === 'INVALID_SHIFT_LOCATION') return res.status(400).json({ error: err.message });
    if (err.message && err.message.includes('Invalid time')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const shift = await shiftService.updateShift(req.params.id, req.body);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    return res.json(shift);
  } catch (err) {
    if (err.code === 'INVALID_SHIFT_LOCATION') return res.status(400).json({ error: err.message });
    if (err.message && err.message.includes('Invalid time')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
};
