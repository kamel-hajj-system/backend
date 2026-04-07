const serviceCenterPreArrivalService = require('./serviceCenterPreArrivalService');

async function getSettings(req, res, next) {
  try {
    const result = await serviceCenterPreArrivalService.getSettings();
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function putSettings(req, res, next) {
  try {
    const body = req.body || {};
    const patch = body.config != null ? body.config : body;
    const result = await serviceCenterPreArrivalService.updateSettings(patch);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSettings,
  putSettings,
};
