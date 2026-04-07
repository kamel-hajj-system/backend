const { prisma } = require('../users/models');

async function getOrCreateSettings() {
  let s = await prisma.serviceCenterPreArrivalSettings.findUnique({ where: { id: 'default' } });
  if (!s) {
    s = await prisma.serviceCenterPreArrivalSettings.create({
      data: { id: 'default', config: {} },
    });
  }
  return s;
}

/** Full JSON config (all sections). */
async function getSettings() {
  const s = await getOrCreateSettings();
  const config = s.config && typeof s.config === 'object' ? s.config : {};
  return { config, updatedAt: s.updatedAt };
}

async function updateSettings(partialConfig) {
  const existing = await getOrCreateSettings();
  const base = existing.config && typeof existing.config === 'object' ? { ...existing.config } : {};
  const patch = partialConfig && typeof partialConfig === 'object' ? partialConfig : {};
  const merged = { ...base, ...patch };
  const s = await prisma.serviceCenterPreArrivalSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', config: merged },
    update: { config: merged },
  });
  const config = s.config && typeof s.config === 'object' ? s.config : {};
  return { config, updatedAt: s.updatedAt };
}

/**
 * Column config for the service center pre-arrival **table only** — independent of `nusuk_settings.columns_config`.
 */
async function getTableColumnsConfig() {
  const s = await getOrCreateSettings();
  const c = s.config && typeof s.config === 'object' ? s.config : {};
  const table = c.table && typeof c.table === 'object' ? c.table : {};
  return table;
}

module.exports = {
  getSettings,
  updateSettings,
  getTableColumnsConfig,
};
