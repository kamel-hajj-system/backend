const rateLimit = require('express-rate-limit');

/**
 * Strict rate limit for login (e.g. 5 per 15 minutes per IP).
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10),
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API rate limit for sensitive endpoints (e.g. create/update/delete user).
 */
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.SENSITIVE_RATE_LIMIT_MAX || '30', 10),
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  sensitiveLimiter,
};
