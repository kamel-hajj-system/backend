const pushService = require('../services/pushService');

function vapidPublicKey(req, res) {
  const enabled = pushService.isPushConfigured();
  return res.json({
    enabled,
    publicKey: enabled ? pushService.getPublicKey() : null,
  });
}

async function subscribe(req, res, next) {
  try {
    if (!pushService.isPushConfigured()) {
      return res.status(503).json({ error: 'Web push is not configured on this server.' });
    }
    pushService.initVapid();
    const { endpoint, keys } = req.body || {};
    const userAgent = req.headers['user-agent'] || null;
    await pushService.saveSubscription(req.user.id, { endpoint, keys, userAgent });
    return res.json({ ok: true });
  } catch (err) {
    if (err && err.message === 'INVALID_SUBSCRIPTION') {
      return res.status(400).json({ error: 'Invalid push subscription payload.' });
    }
    next(err);
  }
}

async function unsubscribe(req, res, next) {
  try {
    const { endpoint } = req.body || {};
    await pushService.removeSubscription(req.user.id, endpoint);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  vapidPublicKey,
  subscribe,
  unsubscribe,
};
