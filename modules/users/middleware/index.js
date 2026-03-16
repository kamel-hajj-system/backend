const { requireAuth, requireAdmin, requireSuperAdmin, requirePermission, allowSelfOrPermission, optionalAuth } = require('./auth');
const { loginLimiter, sensitiveLimiter } = require('./rateLimit');

module.exports = {
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  requirePermission,
  allowSelfOrPermission,
  optionalAuth,
  loginLimiter,
  sensitiveLimiter,
};
