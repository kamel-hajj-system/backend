/** Google Sheet headers → stable camelCase keys stored in `rowData`. */
const NUSK_HEADER_TO_KEY = {
  'اسم الجهة': 'entityName',
  'رقم المجموعة': 'groupNumber',
  'اسم المجموعة': 'groupName',
  'رقم مجموعة الاستعداد المسبق': 'preArrivalGroupNumber',
  'اسم مجموعة الاستعداد المسبق': 'preArrivalGroupName',
  'عدد الحجاج': 'pilgrimsCount',
  'شركة تقديم الخدمة': 'serviceProvider',
  'نوع المنفذ': 'portType',
  'تاريخ القدوم': 'arrivalDate',
  'رقم الرحلة': 'flightNumber',
  'وقت القدوم': 'arrivalTime',
  'مدينة القدوم': 'arrivalCity',
  'حالة الرحلة': 'flightStatus',
  'عقد السكن': 'housingContract',
  'حالة المجموعة': 'groupStatus',
  'رقم مركز الخدمة': 'serviceCenterCode',
  'منفذ الوصول': 'arrivalPort',
  'عقد المسار(المنافذ)': 'portRouteContract',
  'اسم المسار(المشاعر)': 'mashaerRouteName',
  'عقد المسار(المشاعر)': 'mashaerRouteContract',
  'اسم المسار(بين المدن)': 'intercityRouteName',
  'عقد المسار(محطة القطار-السكن بمكة)': 'trainToMakkahRouteContract',
  'عقد المسار(السكن بالمدينة-محطة القطار)': 'madinahToTrainRouteContract',
  'منفذ المغادرة ': 'departurePort',
  'عقد المسار(المغادرة)': 'departureRouteContract',
  'تاريخ الوصول المتوقع(مكة المكرمة)': 'expectedMakkahArrivalDate',
  'تاريخ المغادرة المتوقع(مكة المكرمة)': 'expectedMakkahDepartureDate',
  'عقد سكن مكة': 'makkahHousing',
  'تاريخ الوصول المتوقع(المدينة المنورة)': 'expectedMadinahArrivalDate',
  'تاريخ المغادرة المتوقع(المدينة المنورة)': 'expectedMadinahDepartureDate',
  'عقد سكن المدينة': 'madinahHousing',
  'عقد اعاشة مكة': 'makkahCateringContract',
  'عقد اعاشة المدينة': 'madinahCateringContract',
  'عقود خدمات المشاعر': 'mashaerServicesContract',
  'فئة خدمات المشاعر': 'mashaerServicesTier',
  'عقود المخيمات المرتبطة بعقد الحزم الاساسية': 'campContracts',
};

/**
 * Alternate spellings / older headers from some pilgrim-company sheets → same rowData key.
 * Merged after NUSK_HEADER_TO_KEY (does not override canonical keys).
 */
const EXTRA_SHEET_HEADER_ALIASES = [
  ['عقد المسار ( مكه المكرمة - المدينة )', 'trainToMakkahRouteContract'],
  ['عقد المسار (المدينة المنورة - مكة المكرمة )', 'madinahToTrainRouteContract'],
  ['عقد المسار ( مكة المكرمة - المدينة المنورة )', 'trainToMakkahRouteContract'],
  ['عقد المسار (المدينة المنورة - مكة المكرمة)', 'madinahToTrainRouteContract'],
  ['تاريخ الوصول المتوقع(عقد سكن مكة المكرمة)', 'expectedMakkahArrivalDate'],
  ['تاريخ المغادرة المتوقع(مكة المكرمة)', 'expectedMakkahDepartureDate'],
  ['تاريخ الوصول المتوقع(عقد سكن المدينة المنورة)', 'expectedMadinahArrivalDate'],
  ['تاريخ المغادرة المتوقع(المدينة المنورة)', 'expectedMadinahDepartureDate'],
];

let _normHeaderToKeyCache = null;

function buildNormHeaderToKeyMap() {
  const m = new Map();
  Object.entries(NUSK_HEADER_TO_KEY).forEach(([header, key]) => {
    const nk = normalizeHeader(header);
    if (!m.has(nk)) m.set(nk, key);
  });
  EXTRA_SHEET_HEADER_ALIASES.forEach(([header, key]) => {
    const nk = normalizeHeader(header);
    if (!m.has(nk)) m.set(nk, key);
  });
  return m;
}

function getNormHeaderToKeyMap() {
  if (!_normHeaderToKeyCache) _normHeaderToKeyCache = buildNormHeaderToKeyMap();
  return _normHeaderToKeyCache;
}

/** Resolve a CSV column title to rowData key, or null if unknown. */
function getRowDataKeyForSheetHeader(header) {
  return getNormHeaderToKeyMap().get(normalizeHeader(header)) || null;
}

/** First Arabic label used for this key (for comparison UI). */
function getPrimaryArabicLabelForKey(key) {
  for (const [ar, k] of Object.entries(NUSK_HEADER_TO_KEY)) {
    if (k === key) return ar;
  }
  return key;
}

/** Treat UI placeholders as empty (Nusuk / sheets sometimes store "-" instead of blank). */
function isEmptyLikeCellValue(v) {
  let t = val(v);
  if (t === '') return true;
  try {
    t = t.normalize('NFKC');
  } catch {
    /* ignore */
  }
  // hyphen-minus, en/em dash, unicode minus, fullwidth hyphen, etc.
  if (/^[\s\u00a0]*[-–—‐\u2212\u2010\u2011\u2012\u2013\u2014\u2015\uFE58\uFE63\uFF0D][\s\u00a0]*$/u.test(t)) return true;
  if (/^[-–—‐\u2212\u2010\u2011\u2012\u2013\u2014\u2015\uFE58\uFE63\uFF0D]+$/u.test(t)) return true;
  return false;
}

/** Normalize for equality: placeholders become empty string before digit/space compare. */
function normalizeCellValueForRowCompare(v) {
  return isEmptyLikeCellValue(v) ? '' : val(v);
}

/**
 * Canonical string for sheet↔Nusuk compare: NFKC, collapse all Unicode whitespace,
 * trim, then digit normalization — avoids false diffs from extra spaces / NBSP.
 */
function canonicalComparableString(v) {
  if (isEmptyLikeCellValue(v)) return '';
  let s = val(v);
  try {
    s = s.normalize('NFKC');
  } catch {
    /* ignore */
  }
  s = s.replace(/\s+/gu, ' ').trim();
  return normalizeDigitsForCompare(s);
}

/** True when displayed values should be considered equal (raw cell values from sheet or DB). */
function valuesEqualForRowCompare(a, b) {
  return canonicalComparableString(a) === canonicalComparableString(b);
}

/**
 * Stable normalized key for «رقم مجموعة الاستعداد المسبق» (DB unique index).
 * Null/empty in rowData → null.
 */
function computePreArrivalGroupKey(rowData) {
  if (!rowData || typeof rowData !== 'object') return null;
  const v = rowData.preArrivalGroupNumber;
  if (v == null || String(v).trim() === '') return null;
  return normalizeDigitsForCompare(String(v).trim().replace(/\s+/g, ' '));
}

function val(v) {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string') return v.trim();
  return String(v).trim();
}

/** Trim BOM/spaces so CSV headers match our dictionary (Sheets often adds spaces or BOM). */
function normalizeHeader(h) {
  return String(h ?? '')
    .replace(/^\uFEFF/g, '')
    .replace(/\u200c|\u200f/g, '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFC');
}

function mapRawRowToRowData(raw) {
  const out = {};
  const byNorm = new Map();
  for (const [k, v] of Object.entries(raw)) {
    const nk = normalizeHeader(k);
    if (!nk) continue;
    if (!byNorm.has(nk) || !val(byNorm.get(nk))) byNorm.set(nk, v);
  }
  Object.entries(NUSK_HEADER_TO_KEY).forEach(([header, key]) => {
    const nk = normalizeHeader(header);
    let cell = raw[header];
    if (cell === undefined) cell = byNorm.get(nk);
    if (cell !== undefined) out[key] = val(cell);
  });
  EXTRA_SHEET_HEADER_ALIASES.forEach(([header, key]) => {
    const nk = normalizeHeader(header);
    let cell = raw[header];
    if (cell === undefined) cell = byNorm.get(nk);
    if (cell !== undefined && (out[key] === undefined || out[key] === '')) out[key] = val(cell);
  });
  return out;
}

function isMeaningfulRow(rowData) {
  return Object.values(rowData).some((v) => val(v));
}

function parsePilgrimsCount(rowData) {
  const s = val(rowData.pilgrimsCount);
  if (!s) return null;
  const n = Number(String(s).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normEntityName(s) {
  return val(s).replace(/\s+/g, ' ').trim();
}

/** Arabic/Persian digits → Western; used to compare sheet «رقم مركز الخدمة» with ServiceCenter.code. */
function normalizeDigitsForCompare(str) {
  let out = '';
  for (const ch of String(str)) {
    const u = ch.codePointAt(0);
    if (u >= 0x0660 && u <= 0x0669) out += String(u - 0x0660);
    else if (u >= 0x06f0 && u <= 0x06f9) out += String(u - 0x06f0);
    else out += ch;
  }
  return out;
}

function normServiceCenterCode(s) {
  const v = typeof s === 'string' ? s.trim() : String(s ?? '').trim();
  return normalizeDigitsForCompare(v.replace(/\s+/g, ' '));
}

module.exports = {
  NUSK_HEADER_TO_KEY,
  EXTRA_SHEET_HEADER_ALIASES,
  normalizeHeader,
  getNormHeaderToKeyMap,
  getRowDataKeyForSheetHeader,
  getPrimaryArabicLabelForKey,
  valuesEqualForRowCompare,
  isEmptyLikeCellValue,
  normalizeCellValueForRowCompare,
  computePreArrivalGroupKey,
  mapRawRowToRowData,
  isMeaningfulRow,
  parsePilgrimsCount,
  normEntityName,
  normServiceCenterCode,
  normalizeDigitsForCompare,
  val,
};
