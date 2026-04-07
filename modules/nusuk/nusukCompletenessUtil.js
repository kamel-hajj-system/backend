/**
 * Mirrors Frontend `NusukRowsPage` completeness rules so audit snapshots match the «حالة الحقول» logic.
 */

const NUSUK_META_KEYS = ['arrivalFlightConfirmed', 'actualArrivalStatus', 'actualArrivalCount', 'serviceCenterNote'];

/** Not required for “complete” status (empty is acceptable). */
const COMPLETENESS_OPTIONAL_KEYS = new Set(['serviceCenterNote']);

function getCfg(key, columnsConfig) {
  const rawObj = columnsConfig?.[key];
  const raw = rawObj && typeof rawObj === 'object' && !Array.isArray(rawObj) ? rawObj : {};
  return {
    visible: raw.visible !== false,
  };
}

function isVisibleInConfig(key, columnsConfig) {
  return getCfg(key, columnsConfig).visible !== false;
}

/** Empty: null/undefined, blank, «-», or em dash (sheet placeholders). */
function isNusukFieldValueEmpty(key, row) {
  if (key === 'sheetRowNumber') return row.sheetRowNumber == null;
  if (key === 'entityName') {
    const v = row.entityName;
    return v == null || String(v).trim() === '';
  }
  if (key === 'pilgrimsCount') {
    if (row.pilgrimsCount === null || row.pilgrimsCount === undefined) return true;
    if (typeof row.pilgrimsCount === 'number' && Number.isNaN(row.pilgrimsCount)) return true;
    return false;
  }
  if (key === 'arrivalFlightConfirmed') return row.arrivalFlightConfirmed == null;
  if (key === 'actualArrivalStatus') {
    const s = row.actualArrivalStatus;
    return s == null || String(s).trim() === '';
  }
  if (key === 'actualArrivalCount') return row.actualArrivalCount == null;
  if (key === 'serviceCenterNote') {
    const s = row.serviceCenterNote;
    return s == null || String(s).trim() === '';
  }
  const v = row.rowData?.[key];
  if (v == null || v === '') return true;
  const s = String(v).trim();
  return s === '' || s === '-' || s === '—' || s === '\u2014';
}

function buildOrderedColumnKeysFromRow(row, columnsConfig) {
  const rd = row.rowData && typeof row.rowData === 'object' ? row.rowData : {};
  const allRowDataKeys = Object.keys(rd);
  const rest = allRowDataKeys.filter(
    (k) => k !== 'entityName' && k !== 'pilgrimsCount' && !NUSUK_META_KEYS.includes(k),
  );
  const defaultOrder = ['sheetRowNumber', 'entityName', 'pilgrimsCount', ...NUSUK_META_KEYS, ...rest];
  const saved = columnsConfig?._nusukColumnOrder;
  if (!Array.isArray(saved) || saved.length === 0) return defaultOrder;
  const set = new Set(defaultOrder);
  const seen = new Set();
  const out = [];
  for (const k of saved) {
    if (set.has(k) && !seen.has(k)) {
      out.push(k);
      seen.add(k);
    }
  }
  for (const k of defaultOrder) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}

function computeNusukRowCompleteness(row, orderedColumnKeys, columnsConfig) {
  const emptyKeys = [];
  for (const key of orderedColumnKeys) {
    if (!isVisibleInConfig(key, columnsConfig)) continue;
    if (COMPLETENESS_OPTIONAL_KEYS.has(key)) continue;
    if (isNusukFieldValueEmpty(key, row)) emptyKeys.push(key);
  }
  const allComplete = emptyKeys.length === 0;
  return { allComplete, emptyKeys };
}

module.exports = {
  buildOrderedColumnKeysFromRow,
  computeNusukRowCompleteness,
  isNusukFieldValueEmpty,
};
