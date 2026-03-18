/**
 * Activity logging is disabled in this minimal schema version.
 * Keep the same interface but make it a no-op to avoid touching removed tables.
 * @param {Object} data - { userId, action, ipAddress?, userAgent? }
 */
async function logActivity(_data) {
  return;
}

module.exports = {
  logActivity,
};
