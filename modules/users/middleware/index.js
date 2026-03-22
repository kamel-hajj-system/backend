const {
  requireAuth,
  requireSuperAdmin,
  requireHr,
  requireHrCanEdit,
  requireCompanySupervisor,
  requireAccessCode,
  requirePermission,
  optionalAuth,
} = require('./auth');
const { loginLimiter, sensitiveLimiter } = require('./rateLimit');

module.exports = {
  requireAuth,
  requireSuperAdmin,
  requireHr,
  requireHrCanEdit,
  requireCompanySupervisor,
  requireAccessCode,
  requirePermission,
  optionalAuth,
  loginLimiter,
  sensitiveLimiter,
};
