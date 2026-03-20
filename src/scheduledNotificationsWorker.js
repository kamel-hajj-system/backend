const scheduledNotificationService = require('../modules/notifications/services/scheduledNotificationService');

/**
 * Run scheduled notification processor every minute.
 */
function startScheduledNotificationsWorker() {
  const tick = () => {
    scheduledNotificationService.processTick().catch((e) => console.error('[scheduler]', e));
  };
  tick();
  setInterval(tick, 60_000);
}

module.exports = { startScheduledNotificationsWorker };
