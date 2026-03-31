const {
  requireAuth,
  requireSuperAdmin,
  requireHr,
  requireHrCanEdit,
  requireCompanySupervisor,
  requireCompanySupervisorOrAccessCodes,
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
  requireCompanySupervisorOrAccessCodes,
  requireAccessCode,
  requirePermission,
  optionalAuth,
  loginLimiter,
  sensitiveLimiter,
};
