const { parse } = require('csv-parse/sync');
const { prisma } = require('../users/models');
const nusukService = require('../nusuk/nusukService');
const {
  normalizeGoogleSheetUrl,
  GOOGLE_SHEET_CSV_FETCH_HEADERS,
  sheetHtmlResponseHint,
} = require('../../utils/googleSheetCsvUrl');
const {
  NUSK_HEADER_TO_KEY,
  mapRawRowToRowData,
  normEntityName,
  normalizeDigitsForCompare,
  getRowDataKeyForSheetHeader,
  getPrimaryArabicLabelForKey,
  valuesEqualForRowCompare,
  isEmptyLikeCellValue,
  normalizeCellValueForRowCompare,
  val,
  parsePilgrimsCount,
} = require('../nusuk/nusukColumnMap');

/** Same equality as buildRowCompare `same` flag (normalized compare). */
function fieldValuesMatchForApply(sheetCell, nusukCell) {
  return valuesEqualForRowCompare(sheetCell, nusukCell);
}

const ALLOWED_NUSUK_FIELD_KEYS = new Set(Object.values(NUSK_HEADER_TO_KEY));

const MAX_SHEETS = 10;

/** Cache pilgrim-company CSV parses per sheet source (2–5 min TTL; suggestions endpoint only). */
const PILGRIM_SHEET_CSV_CACHE_TTL_MS = 4 * 60 * 1000;
const pilgrimSheetCsvCache = new Map();

function normPreArrivalKey(v) {
  const s = String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return normalizeDigitsForCompare(s);
}

async function fetchCsvRows(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: GOOGLE_SHEET_CSV_FETCH_HEADERS,
      redirect: 'follow',
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (/<!doctype html/i.test(text) || (/<html/i.test(text) && text.length > 500)) {
      throw new Error(
        `URL did not return CSV (share sheet as "Anyone with the link" Viewer; check gid)${sheetHtmlResponseHint(text)}`
      );
    }
    return parse(text, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Row snapshot for comparing sheet columns to Nusuk: merges DB top-level fields used by the edit form
 * into the same shape as `mapRawRowToRowData` output.
 */
function mergeNusukRowForPilgrimCompare(nusukRow) {
  const rd = nusukRow.rowData && typeof nusukRow.rowData === 'object' ? { ...nusukRow.rowData } : {};
  rd.entityName = nusukRow.entityName ?? rd.entityName;
  if (nusukRow.pilgrimsCount != null && nusukRow.pilgrimsCount !== undefined) {
    rd.pilgrimsCount = nusukRow.pilgrimsCount;
  }
  if (nusukRow.arrivalFlightConfirmed !== undefined) rd.arrivalFlightConfirmed = nusukRow.arrivalFlightConfirmed;
  if (nusukRow.actualArrivalStatus !== undefined) rd.actualArrivalStatus = nusukRow.actualArrivalStatus;
  if (nusukRow.actualArrivalCount !== undefined) rd.actualArrivalCount = nusukRow.actualArrivalCount;
  if (nusukRow.serviceCenterNote !== undefined) rd.serviceCenterNote = nusukRow.serviceCenterNote;
  return rd;
}

async function fetchCsvRowsCachedForSource(sourceId, url) {
  const now = Date.now();
  const hit = pilgrimSheetCsvCache.get(sourceId);
  if (hit && hit.expiresAt > now) {
    return { rawRows: hit.rawRows, cacheHit: true };
  }
  const rawRows = await fetchCsvRows(url);
  pilgrimSheetCsvCache.set(sourceId, { rawRows, expiresAt: now + PILGRIM_SHEET_CSV_CACHE_TTL_MS });
  return { rawRows, cacheHit: false };
}

/**
 * Suggestions for Nusuk edit modal: one pilgrim sheet whose configured name matches `اسم الجهة`
 * (normalized like PilgrimCompany matching). Always returns a safe JSON object (no throw for
 * missing sheet / fetch errors) so the client can keep the form usable.
 */
async function getPilgrimSheetSuggestionsForNusukRow(nusukRowId) {
  let nusukRow;
  try {
    nusukRow = await prisma.nusukSheetRow.findUnique({ where: { id: nusukRowId } });
  } catch (e) {
    return {
      ok: false,
      code: 'LOAD_FAILED',
      message: e?.message || 'Failed to load row',
    };
  }
  if (!nusukRow) {
    return { ok: false, code: 'ROW_NOT_FOUND', message: 'Row not found' };
  }

  const entityNameRaw = nusukRow.entityName || '';
  const entityKey = normEntityName(entityNameRaw);
  if (!entityKey) {
    return {
      ok: false,
      code: 'NO_ENTITY_NAME',
      message: 'This row has no entity name to match a pilgrim company sheet',
    };
  }

  let sources;
  try {
    sources = await listAll();
  } catch (e) {
    return {
      ok: false,
      code: 'SOURCES_LOAD_FAILED',
      message: e?.message || 'Failed to load sheet list',
    };
  }

  const source = sources.find((s) => normEntityName(s.name) === entityKey);
  if (!source) {
    return {
      ok: false,
      code: 'NO_MATCHING_SHEET',
      message: 'No pilgrim company sheet is registered with this entity name',
    };
  }

  const nusukMerged = mergeNusukRowForPilgrimCompare(nusukRow);
  const preVal = nusukMerged.preArrivalGroupNumber;
  if (preVal == null || String(preVal).trim() === '') {
    return {
      ok: false,
      code: 'NO_PRE_ARRIVAL_KEY',
      message: 'This row has no pre-arrival group number to match the sheet row',
    };
  }
  const preKey = normPreArrivalKey(preVal);

  let rawRows;
  let cacheHit = false;
  try {
    const fetched = await fetchCsvRowsCachedForSource(source.id, source.sheetUrl);
    rawRows = fetched.rawRows;
    cacheHit = fetched.cacheHit;
  } catch (e) {
    return {
      ok: false,
      code: 'FETCH_ERROR',
      message: e?.message || 'Failed to fetch pilgrim sheet',
    };
  }

  const headers = rawRows.length ? Object.keys(rawRows[0]) : [];
  const parsed = parseExternalSheetRows(rawRows);
  const match = parsed.find((r) => r.preKey === preKey);
  if (!match) {
    return {
      ok: false,
      code: 'SHEET_ROW_NOT_FOUND',
      message: 'This pre-arrival group was not found in the pilgrim company sheet',
    };
  }

  const rowCompare = buildRowCompare(match.rowData, nusukMerged, headers, match.raw);
  return {
    ok: true,
    source: { id: source.id, name: source.name },
    comparedFields: rowCompare.comparedFields,
    pilgrimsOnlyColumns: rowCompare.pilgrimsOnlyColumns,
    cacheHit,
    fetchedAt: new Date().toISOString(),
    cacheTtlSeconds: Math.floor(PILGRIM_SHEET_CSV_CACHE_TTL_MS / 1000),
  };
}

/** First Nusuk row per normalized pre-arrival key (id + rowData for compare and apply). */
async function buildNusukPreArrivalRowMap() {
  const rows = await prisma.nusukSheetRow.findMany({ select: { id: true, rowData: true } });
  const map = new Map();
  for (const r of rows) {
    const rd = r.rowData && typeof r.rowData === 'object' ? r.rowData : {};
    const v = rd.preArrivalGroupNumber;
    if (v == null || String(v).trim() === '') continue;
    const k = normPreArrivalKey(v);
    if (!map.has(k)) map.set(k, { id: r.id, rowData: rd });
  }
  return map;
}

/** Full row (for merge + buildRowCompare) per first occurrence of normalized pre-arrival key. */
async function buildNusukPreArrivalFullRowMap() {
  const rows = await prisma.nusukSheetRow.findMany({
    select: {
      entityName: true,
      pilgrimsCount: true,
      rowData: true,
      arrivalFlightConfirmed: true,
      actualArrivalStatus: true,
      actualArrivalCount: true,
      serviceCenterNote: true,
    },
  });
  const map = new Map();
  for (const r of rows) {
    const rd = r.rowData && typeof r.rowData === 'object' ? r.rowData : {};
    const v = rd.preArrivalGroupNumber;
    if (v == null || String(v).trim() === '') continue;
    const k = normPreArrivalKey(v);
    if (!map.has(k)) map.set(k, r);
  }
  return map;
}

function cellDisplayString(v) {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v).trim();
}

function isTotallyBlankRow(raw) {
  return !Object.values(raw).some((v) => cellDisplayString(v));
}

/** Parse every data row; keep all columns for display. Skip only empty lines. */
function parseExternalSheetRows(rawRows) {
  const out = [];
  rawRows.forEach((raw, idx) => {
    if (isTotallyBlankRow(raw)) return;
    const sheetRowNumber = idx + 2;
    const rowData = mapRawRowToRowData(raw);
    const pre = rowData.preArrivalGroupNumber;
    const preStr = pre != null ? String(pre).trim() : '';
    const entityName = normEntityName(rowData.entityName) || '';
    out.push({
      sheetRowNumber,
      preArrivalGroupNumber: preStr,
      preKey: preStr ? normPreArrivalKey(preStr) : '',
      entityName: entityName || null,
      rowData,
      raw,
    });
  });
  return out;
}

/**
 * Overlapping fields: same rowData keys present as columns in the pilgrim sheet vs Nusuk row.
 * Nusuk-only fields are ignored. Unmapped sheet columns listed as pilgrims-only.
 */
function buildRowCompare(sheetRowData, nusukRowData, headers, raw) {
  const nusukRd = nusukRowData && typeof nusukRowData === 'object' ? nusukRowData : {};
  const orderedKeys = [];
  const seen = new Set();
  for (const h of headers) {
    const k = getRowDataKeyForSheetHeader(h);
    if (k && !seen.has(k)) {
      seen.add(k);
      orderedKeys.push(k);
    }
  }
  const comparedFields = orderedKeys.map((key) => {
    const sv = val(sheetRowData[key]);
    const nv = val(nusukRd[key]);
    const same = valuesEqualForRowCompare(sheetRowData[key], nusukRd[key]);
    /** Copy when Nusuk is empty/placeholder and pilgrim sheet has a real value. */
    const applyable =
      !same &&
      !isEmptyLikeCellValue(sheetRowData[key]) &&
      isEmptyLikeCellValue(nusukRd[key]);
    /** Overwrite Nusuk when both sides have a real value but they differ. */
    const overwriteable =
      !same &&
      !isEmptyLikeCellValue(sheetRowData[key]) &&
      !isEmptyLikeCellValue(nusukRd[key]);
    return {
      key,
      labelAr: getPrimaryArabicLabelForKey(key),
      sheetValue: sv,
      nusukValue: nv,
      status: same ? 'same' : 'diff',
      applyable,
      overwriteable,
    };
  });
  const diffCount = comparedFields.filter((f) => f.status === 'diff').length;
  const pilgrimsOnlyColumns = [];
  for (const h of headers) {
    if (getRowDataKeyForSheetHeader(h)) continue;
    const cell = cellDisplayString(raw[h]);
    if (cell) pilgrimsOnlyColumns.push({ header: h, value: cell });
  }
  return {
    comparedFields,
    diffCount,
    allComparedMatch: diffCount === 0,
    pilgrimsOnlyColumns,
  };
}

/**
 * Copy one field from the live pilgrim Google Sheet into Nusuk (fill empty fields only).
 * Re-fetches CSV and uses the sheet cell value (not client-provided text).
 */
async function applyFieldFromPilgrimSheetToNusuk(sourceId, { nusukRowId, fieldKey, overwrite = false }) {
  if (!nusukRowId || !fieldKey) {
    const err = new Error('nusukRowId and fieldKey are required');
    err.statusCode = 400;
    throw err;
  }
  if (!ALLOWED_NUSUK_FIELD_KEYS.has(fieldKey)) {
    const err = new Error('Invalid field key');
    err.statusCode = 400;
    throw err;
  }

  const nusukRow = await prisma.nusukSheetRow.findUnique({ where: { id: nusukRowId } });
  if (!nusukRow) {
    const err = new Error('Nusuk row not found');
    err.statusCode = 404;
    throw err;
  }
  const nusukRd = nusukRow.rowData && typeof nusukRow.rowData === 'object' ? nusukRow.rowData : {};
  const preVal = nusukRd.preArrivalGroupNumber;
  if (preVal == null || String(preVal).trim() === '') {
    const err = new Error('Nusuk row has no pre-arrival group number');
    err.statusCode = 400;
    throw err;
  }
  const preKey = normPreArrivalKey(preVal);

  if (!overwrite && !isEmptyLikeCellValue(nusukRd[fieldKey])) {
    const err = new Error('This field already has a value in Nusuk; only empty fields can be filled from the pilgrim sheet.');
    err.statusCode = 409;
    err.code = 'NUSUK_FIELD_NOT_EMPTY';
    throw err;
  }

  const source = await prisma.pilgrimCompanyExternalSheet.findUnique({ where: { id: sourceId } });
  if (!source) {
    const err = new Error('Sheet source not found');
    err.statusCode = 404;
    throw err;
  }

  let rawRows;
  try {
    rawRows = await fetchCsvRows(source.sheetUrl);
  } catch (e) {
    const err = new Error(e.message || 'Failed to fetch pilgrim sheet');
    err.statusCode = 502;
    throw err;
  }

  const parsed = parseExternalSheetRows(rawRows);
  const match = parsed.find((r) => r.preKey === preKey);
  if (!match) {
    const err = new Error('This group was not found in this pilgrim sheet');
    err.statusCode = 404;
    err.code = 'SHEET_ROW_NOT_FOUND';
    throw err;
  }

  if (isEmptyLikeCellValue(match.rowData[fieldKey])) {
    const err = new Error('No value in this pilgrim sheet for this field');
    err.statusCode = 400;
    err.code = 'SHEET_VALUE_EMPTY';
    throw err;
  }
  const sheetVal = val(match.rowData[fieldKey]);

  if (overwrite) {
    if (
      isEmptyLikeCellValue(nusukRd[fieldKey]) ||
      fieldValuesMatchForApply(match.rowData[fieldKey], nusukRd[fieldKey])
    ) {
      const err = new Error(
        'Overwrite applies only when both Nusuk and the pilgrim sheet have values that differ.',
      );
      err.statusCode = 400;
      err.code = 'OVERWRITE_NOT_APPLICABLE';
      throw err;
    }
  }

  const updated = await nusukService.applyPilgrimSheetFieldToNusukRow(nusukRowId, fieldKey, sheetVal, {
    overwrite,
  });
  if (!updated) {
    const err = new Error('Nusuk row not found');
    err.statusCode = 404;
    throw err;
  }
  return updated;
}

/** Copy every pilgrim-sheet value into Nusuk where Nusuk is empty-like and the sheet has a value (one DB update). */
async function applyAllEmptyFieldsFromPilgrimSheetToNusuk(sourceId, { nusukRowId, includeOverwrite = false }) {
  if (!nusukRowId) {
    const err = new Error('nusukRowId is required');
    err.statusCode = 400;
    throw err;
  }

  const nusukRow = await prisma.nusukSheetRow.findUnique({ where: { id: nusukRowId } });
  if (!nusukRow) {
    const err = new Error('Nusuk row not found');
    err.statusCode = 404;
    throw err;
  }
  const nusukRd = nusukRow.rowData && typeof nusukRow.rowData === 'object' ? nusukRow.rowData : {};
  const preVal = nusukRd.preArrivalGroupNumber;
  if (preVal == null || String(preVal).trim() === '') {
    const err = new Error('Nusuk row has no pre-arrival group number');
    err.statusCode = 400;
    throw err;
  }
  const preKey = normPreArrivalKey(preVal);

  const source = await prisma.pilgrimCompanyExternalSheet.findUnique({ where: { id: sourceId } });
  if (!source) {
    const err = new Error('Sheet source not found');
    err.statusCode = 404;
    throw err;
  }

  let rawRows;
  try {
    rawRows = await fetchCsvRows(source.sheetUrl);
  } catch (e) {
    const err = new Error(e.message || 'Failed to fetch pilgrim sheet');
    err.statusCode = 502;
    throw err;
  }

  const parsed = parseExternalSheetRows(rawRows);
  const match = parsed.find((r) => r.preKey === preKey);
  if (!match) {
    const err = new Error('This group was not found in this pilgrim sheet');
    err.statusCode = 404;
    err.code = 'SHEET_ROW_NOT_FOUND';
    throw err;
  }

  let nextRowData =
    nusukRow.rowData && typeof nusukRow.rowData === 'object' ? { ...nusukRow.rowData } : {};
  let changed = 0;
  for (const fieldKey of ALLOWED_NUSUK_FIELD_KEYS) {
    if (isEmptyLikeCellValue(match.rowData[fieldKey])) continue;
    const sheetVal = val(match.rowData[fieldKey]);
    if (!sheetVal) continue;

    if (includeOverwrite) {
      if (fieldValuesMatchForApply(match.rowData[fieldKey], nextRowData[fieldKey])) continue;
      nextRowData[fieldKey] = sheetVal;
      changed += 1;
      continue;
    }

    if (!isEmptyLikeCellValue(nextRowData[fieldKey])) continue;
    nextRowData[fieldKey] = sheetVal;
    changed += 1;
  }

  if (changed === 0) {
    const err = new Error(
      includeOverwrite
        ? 'No differing fields to update from this pilgrim sheet'
        : 'No empty Nusuk fields to fill from this pilgrim sheet',
    );
    err.statusCode = 400;
    err.code = 'NOTHING_TO_APPLY';
    throw err;
  }

  const updated = await nusukService.applyPilgrimSheetRowDataMerge(nusukRowId, nextRowData);
  if (!updated) {
    const err = new Error('Nusuk row not found');
    err.statusCode = 404;
    throw err;
  }
  return updated;
}

async function listAll() {
  return prisma.pilgrimCompanyExternalSheet.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

async function createSheet({ name, sheetUrl, sortOrder = 0 }) {
  const count = await prisma.pilgrimCompanyExternalSheet.count();
  if (count >= MAX_SHEETS) {
    const err = new Error(`Maximum ${MAX_SHEETS} sheet sources allowed`);
    err.statusCode = 400;
    throw err;
  }
  const normalized = normalizeGoogleSheetUrl(sheetUrl);
  if (!normalized) {
    const err = new Error('Invalid Google Sheets URL');
    err.statusCode = 400;
    throw err;
  }
  const n = String(name || '').trim();
  if (!n) {
    const err = new Error('Name is required');
    err.statusCode = 400;
    throw err;
  }
  return prisma.pilgrimCompanyExternalSheet.create({
    data: {
      name: n.slice(0, 200),
      sheetUrl: normalized,
      sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    },
  });
}

async function updateSheet(id, { name, sheetUrl, sortOrder }) {
  const data = {};
  if (name !== undefined) {
    const n = String(name || '').trim();
    if (!n) {
      const err = new Error('Name is required');
      err.statusCode = 400;
      throw err;
    }
    data.name = n.slice(0, 200);
  }
  if (sheetUrl !== undefined) {
    const normalized = normalizeGoogleSheetUrl(sheetUrl);
    if (!normalized) {
      const err = new Error('Invalid Google Sheets URL');
      err.statusCode = 400;
      throw err;
    }
    data.sheetUrl = normalized;
  }
  if (sortOrder !== undefined) {
    data.sortOrder = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0;
  }
  return prisma.pilgrimCompanyExternalSheet.update({
    where: { id },
    data,
  });
}

async function deleteSheet(id) {
  await prisma.pilgrimCompanyExternalSheet.delete({ where: { id } });
}

/** Same name-key matching as Nusuk rows → PilgrimCompany (`normEntityName` on `اسم الجهة` vs `company.name`). */
function pilgrimCompanyForEntityName(entityName, companyLookup) {
  if (!companyLookup) return null;
  const nameKey = entityName ? normEntityName(entityName) : '';
  if (!nameKey) return null;
  const pc = companyLookup.get(nameKey);
  if (!pc) return null;
  return {
    id: pc.id,
    name: pc.name,
    nameAr: pc.nameAr,
    externalCode: pc.externalCode,
    expectedPilgrimsCount: pc.expectedPilgrimsCount,
  };
}

async function loadPilgrimCompanyLookupMap() {
  const companies = await prisma.pilgrimCompany.findMany({
    select: { id: true, name: true, nameAr: true, externalCode: true, expectedPilgrimsCount: true },
  });
  const byExact = new Map();
  for (const c of companies) {
    const k = normEntityName(c.name);
    if (k && !byExact.has(k)) byExact.set(k, c);
  }
  return byExact;
}

/**
 * Build preview rows from already-fetched CSV rows + Nusuk pre-arrival map (single map for all sources).
 * @param {Map<string, object>} [companyLookup] — normalized company name → PilgrimCompany row
 */
function buildPreviewPayloadFromRawRows(source, rawRows, nusukRowMap, companyLookup) {
  const nusukSet = new Set(nusukRowMap.keys());
  const headers = rawRows.length ? Object.keys(rawRows[0]) : [];
  const parsed = parseExternalSheetRows(rawRows);
  let matched = 0;
  let notIn = 0;
  let withKey = 0;
  let matchedRowsWithFieldDiffs = 0;

  const rows = parsed.map((r) => {
    const hasKey = Boolean(r.preKey);
    if (hasKey) withKey += 1;
    let inNusuk = false;
    let rowCompare = null;
    let nusukRowId = null;
    if (hasKey) {
      inNusuk = nusukSet.has(r.preKey);
      if (inNusuk) {
        matched += 1;
        const entry = nusukRowMap.get(r.preKey);
        nusukRowId = entry.id;
        rowCompare = buildRowCompare(r.rowData, entry.rowData, headers, r.raw);
        if (!rowCompare.allComparedMatch) matchedRowsWithFieldDiffs += 1;
      } else {
        notIn += 1;
      }
    }
    const cells = {};
    for (const h of headers) {
      cells[h] = cellDisplayString(r.raw[h]);
    }
    return {
      sheetRowNumber: r.sheetRowNumber,
      preArrivalGroupNumber: r.preArrivalGroupNumber || '—',
      inNusuk: hasKey ? inNusuk : null,
      nusukRowId,
      entityName: r.entityName,
      cells,
      rowCompare,
      pilgrimCompany: pilgrimCompanyForEntityName(r.entityName, companyLookup),
    };
  });

  return {
    headers,
    stats: {
      sheetRowCount: rawRows.length,
      rowsWithKey: withKey,
      matchedInNusuk: matched,
      notInNusuk: notIn,
      nusukDistinctKeys: nusukSet.size,
      matchedRowsWithFieldDiffs,
      rowsWithoutPreArrivalKey: Math.max(0, parsed.length - withKey),
    },
    rows,
  };
}

/**
 * Fetch sheet + compare رقم مجموعة الاستعداد المسبق with Nusuk rowData.preArrivalGroupNumber.
 */
async function getPreviewForSource(id) {
  const source = await prisma.pilgrimCompanyExternalSheet.findUnique({ where: { id } });
  if (!source) return null;

  let nusukRowMap;
  try {
    nusukRowMap = await buildNusukPreArrivalRowMap();
  } catch (e) {
    return {
      source: { id: source.id, name: source.name },
      resolvedUrl: source.sheetUrl,
      headers: [],
      stats: null,
      rows: [],
      fetchError: e?.message || 'Nusuk load failed',
    };
  }

  let rawRows;
  try {
    rawRows = await fetchCsvRows(source.sheetUrl);
  } catch (e) {
    return {
      source: { id: source.id, name: source.name },
      resolvedUrl: source.sheetUrl,
      headers: [],
      stats: {
        sheetRowCount: 0,
        rowsWithKey: 0,
        matchedInNusuk: 0,
        notInNusuk: 0,
        nusukDistinctKeys: nusukRowMap.size,
        matchedRowsWithFieldDiffs: 0,
        rowsWithoutPreArrivalKey: 0,
      },
      rows: [],
      fetchError: e?.message || 'Failed to fetch sheet',
    };
  }

  const companyLookup = await loadPilgrimCompanyLookupMap();
  const { headers, stats, rows } = buildPreviewPayloadFromRawRows(source, rawRows, nusukRowMap, companyLookup);

  return {
    source: { id: source.id, name: source.name },
    resolvedUrl: source.sheetUrl,
    headers,
    stats,
    rows,
    fetchError: null,
  };
}

/**
 * Pilgrims counted as "actually arrived" from one Nusuk row (aligned with service center overviews).
 */
function actualArrivalContributionFromNusukRow(row) {
  const st = row.actualArrivalStatus;
  const pc = row.pilgrimsCount != null && Number.isFinite(Number(row.pilgrimsCount)) ? Number(row.pilgrimsCount) : 0;
  const acRaw = row.actualArrivalCount;
  const ac = acRaw != null && Number.isFinite(Number(acRaw)) ? Number(acRaw) : null;
  if (st === 'yes') return ac != null ? ac : pc;
  if (st === 'partial') return ac != null ? ac : 0;
  return 0;
}

/**
 * Row has a non-empty pre-arrival group number in stored Nusuk `rowData` (استعداد مسبق).
 */
function hasPreArrivalGroupNumberInRow(row) {
  const rd = row.rowData && typeof row.rowData === 'object' ? row.rowData : {};
  const v = rd.preArrivalGroupNumber;
  if (v == null) return false;
  const s = String(v).trim();
  return s !== '' && s !== '-' && s !== '—' && s !== '\u2014';
}

/**
 * Reception dashboard:
 * - **Total expected pilgrims** = Σ `pilgrim_companies.expected_pilgrims_count` (DB table only; not Google Sheets).
 * - **Nusuk metrics** = from `nusuk_sheet_rows` (inputs with pre-arrival group #, actual arrival).
 * - Pre-arrival % = Nusuk input pilgrims / expected (companies) × 100.
 * - Actual arrival % = actual-arrival sum / expected (companies) × 100.
 *
 * @param {string} scopeRaw — `pre_arrival` | `actual_arrival` | `all` (informational; same aggregates returned)
 */
async function getReceptionDashboardStats(scopeRaw) {
  const allowed = new Set(['pre_arrival', 'actual_arrival', 'all']);
  const scope = allowed.has(String(scopeRaw || '').toLowerCase()) ? String(scopeRaw || '').toLowerCase() : 'pre_arrival';

  const [companyAgg, nusukRows] = await Promise.all([
    prisma.pilgrimCompany.aggregate({ _sum: { expectedPilgrimsCount: true } }),
    prisma.nusukSheetRow.findMany({
      select: { pilgrimsCount: true, actualArrivalStatus: true, actualArrivalCount: true, rowData: true },
    }),
  ]);

  const expectedPilgrimsFromCompanies = companyAgg._sum.expectedPilgrimsCount ?? 0;

  const pilgrimsOf = (r) => {
    const pc = r.pilgrimsCount;
    return pc != null && Number.isFinite(Number(pc)) ? Number(pc) : 0;
  };

  let nusukInputPilgrims = 0;
  let actualArrivalSum = 0;

  for (const r of nusukRows) {
    const p = pilgrimsOf(r);
    if (hasPreArrivalGroupNumberInRow(r)) nusukInputPilgrims += p;
    actualArrivalSum += actualArrivalContributionFromNusukRow(r);
  }

  const actualArrivalTotal = Math.round(actualArrivalSum);

  const denom = expectedPilgrimsFromCompanies;

  const preArrivalReadinessPercent =
    denom > 0 ? Math.min(100, Math.round((nusukInputPilgrims / denom) * 100)) : 0;

  const actualArrivalRatePercent =
    denom > 0 ? Math.min(100, Math.round((actualArrivalSum / denom) * 100)) : 0;

  const remainingPreArrival = Math.max(0, expectedPilgrimsFromCompanies - nusukInputPilgrims);
  const remainingActual = Math.max(0, expectedPilgrimsFromCompanies - actualArrivalTotal);

  return {
    scope,
    /** Σ expected_pilgrims_count — `pilgrim_companies` table (first KPI card). */
    totalPilgrims: expectedPilgrimsFromCompanies,
    nusukInputPilgrims,
    actualArrivalTotal,
    remainingPreArrival,
    remainingActual,
    preArrivalReadinessPercent,
    actualArrivalRatePercent,
  };
}

const PORT_BREAKDOWN_BUCKET_EMPTY = '__empty__';
const PORT_BREAKDOWN_BUCKET_OTHER = '__other__';
const PORT_BREAKDOWN_TOP = 12;

function portLabelKeyFromCell(raw) {
  if (raw == null || isEmptyLikeCellValue(raw)) return PORT_BREAKDOWN_BUCKET_EMPTY;
  const s = String(raw).trim().normalize('NFC');
  return s || PORT_BREAKDOWN_BUCKET_EMPTY;
}

function mergeTopPortBuckets(map, topN) {
  const entries = [...map.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length <= topN) {
    return entries.map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }
  const head = entries.slice(0, topN - 1);
  const tailSum = entries.slice(topN - 1).reduce((s, [, v]) => s + v, 0);
  return [
    ...head.map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })),
    { name: PORT_BREAKDOWN_BUCKET_OTHER, value: Math.round(tailSum * 100) / 100 },
  ];
}

function pilgrimsCountOfRow(row) {
  const pc = row.pilgrimsCount;
  return pc != null && Number.isFinite(Number(pc)) ? Number(pc) : 0;
}

/**
 * Reception dashboard — pilgrims (or actual-arrival weight) per `rowData.portType` and `rowData.arrivalPort`,
 * filtered by the same `scope` semantics as KPI cards.
 *
 * @param {string} scopeRaw — `pre_arrival` | `actual_arrival` | `all`
 */
async function getReceptionDashboardPortBreakdown(scopeRaw) {
  const allowed = new Set(['pre_arrival', 'actual_arrival', 'all']);
  const scope = allowed.has(String(scopeRaw || '').toLowerCase()) ? String(scopeRaw || '').toLowerCase() : 'pre_arrival';

  const nusukRows = await prisma.nusukSheetRow.findMany({
    select: { pilgrimsCount: true, actualArrivalStatus: true, actualArrivalCount: true, rowData: true },
  });

  const weightForRow = (row) => {
    if (scope === 'pre_arrival') {
      if (!hasPreArrivalGroupNumberInRow(row)) return 0;
      return pilgrimsCountOfRow(row);
    }
    if (scope === 'actual_arrival') {
      return actualArrivalContributionFromNusukRow(row);
    }
    const w = pilgrimsCountOfRow(row);
    return w > 0 ? w : 0;
  };

  const mapPortType = new Map();
  const mapArrivalPort = new Map();

  for (const row of nusukRows) {
    const w = weightForRow(row);
    if (w <= 0) continue;
    const rd = row.rowData && typeof row.rowData === 'object' ? row.rowData : {};
    const pk = portLabelKeyFromCell(rd.portType);
    const ak = portLabelKeyFromCell(rd.arrivalPort);
    mapPortType.set(pk, (mapPortType.get(pk) || 0) + w);
    mapArrivalPort.set(ak, (mapArrivalPort.get(ak) || 0) + w);
  }

  return {
    scope,
    byPortType: mergeTopPortBuckets(mapPortType, PORT_BREAKDOWN_TOP),
    byArrivalPort: mergeTopPortBuckets(mapArrivalPort, PORT_BREAKDOWN_TOP),
  };
}

/**
 * Reception Nusuk rows page — aggregates in one pass over cached mission CSVs:
 * expected pilgrims (DB), pilgrim sums, flight counts, pre-arrival key match %, overlapping column data match %.
 */
async function getReceptionNusukRowsSummary() {
  const [expectedAgg, nusukPilgrimAgg, nusukFlightCount, nusukKeyMap] = await Promise.all([
    prisma.pilgrimCompany.aggregate({ _sum: { expectedPilgrimsCount: true } }),
    prisma.nusukSheetRow.aggregate({ _sum: { pilgrimsCount: true } }),
    prisma.nusukSheetRow.count(),
    buildNusukPreArrivalFullRowMap(),
  ]);

  const totalExpectedPilgrims = expectedAgg._sum.expectedPilgrimsCount ?? 0;
  const totalNusukPilgrims = nusukPilgrimAgg._sum.pilgrimsCount ?? 0;

  const sources = await listAll();
  if (!sources.length) {
    return {
      totalExpectedPilgrims,
      totalMissionPilgrims: 0,
      totalNusukPilgrims,
      pilgrimMatchPercent: 0,
      missionFlightCount: 0,
      nusukFlightCount,
      preArrivalFlightMatchPercent: 0,
      dataMatchPercent: 0,
      missionSheetSourceCount: 0,
      missionSheetsFetchErrors: 0,
    };
  }

  let totalMissionPilgrims = 0;
  let missionRowsWithPreKey = 0;
  let matchedPreArrivalRows = 0;
  let dataFullMatchRows = 0;
  let fetchErrors = 0;

  await Promise.all(
    sources.map(async (source) => {
      try {
        const { rawRows } = await fetchCsvRowsCachedForSource(source.id, source.sheetUrl);
        const headers = rawRows.length ? Object.keys(rawRows[0]) : [];
        const parsed = parseExternalSheetRows(rawRows);
        for (const r of parsed) {
          const n = parsePilgrimsCount(r.rowData);
          if (n != null) totalMissionPilgrims += n;
          if (!r.preKey) continue;
          missionRowsWithPreKey += 1;
          const nusukRow = nusukKeyMap.get(r.preKey);
          if (!nusukRow) continue;
          matchedPreArrivalRows += 1;
          const merged = mergeNusukRowForPilgrimCompare(nusukRow);
          const rc = buildRowCompare(r.rowData, merged, headers, r.raw);
          if (rc.allComparedMatch) dataFullMatchRows += 1;
        }
      } catch {
        fetchErrors += 1;
      }
    }),
  );

  const pilgrimMatchPercent =
    totalMissionPilgrims > 0
      ? Math.min(100, Math.round((totalNusukPilgrims / totalMissionPilgrims) * 100))
      : 0;

  const preArrivalFlightMatchPercent =
    missionRowsWithPreKey > 0
      ? Math.min(100, Math.round((matchedPreArrivalRows / missionRowsWithPreKey) * 100))
      : 0;

  const dataMatchPercent =
    matchedPreArrivalRows > 0
      ? Math.min(100, Math.round((dataFullMatchRows / matchedPreArrivalRows) * 100))
      : 0;

  return {
    totalExpectedPilgrims,
    totalMissionPilgrims,
    totalNusukPilgrims,
    pilgrimMatchPercent,
    missionFlightCount: missionRowsWithPreKey,
    nusukFlightCount,
    preArrivalFlightMatchPercent,
    dataMatchPercent,
    missionSheetSourceCount: sources.length,
    missionSheetsFetchErrors: fetchErrors,
  };
}

/**
 * Per-row flags: mission sheet row vs Nusuk (same rules as edit suggestions). O(n) over Nusuk rows
 * with one cached CSV parse per mission sheet.
 */
async function getNusukSheetCompareFlags() {
  const sources = await listAll();
  const entityKeyToSource = new Map();
  for (const s of sources) {
    const k = normEntityName(s.name);
    if (k) entityKeyToSource.set(k, s);
  }

  const sourcePayload = await Promise.all(
    sources.map(async (source) => {
      try {
        const { rawRows } = await fetchCsvRowsCachedForSource(source.id, source.sheetUrl);
        const headers = rawRows.length ? Object.keys(rawRows[0]) : [];
        const parsed = parseExternalSheetRows(rawRows);
        const byPre = new Map();
        for (const r of parsed) {
          if (r.preKey) byPre.set(r.preKey, r);
        }
        return { sourceId: source.id, headers, byPre, ok: true };
      } catch {
        return { sourceId: source.id, headers: [], byPre: new Map(), ok: false };
      }
    }),
  );
  const sourceIdToPayload = new Map(sourcePayload.map((p) => [p.sourceId, p]));

  const nusukRows = await prisma.nusukSheetRow.findMany({
    select: {
      id: true,
      entityName: true,
      pilgrimsCount: true,
      rowData: true,
      arrivalFlightConfirmed: true,
      actualArrivalStatus: true,
      actualArrivalCount: true,
      serviceCenterNote: true,
    },
  });

  const flags = [];
  for (const row of nusukRows) {
    const entityKey = normEntityName(row.entityName);
    const source = entityKey ? entityKeyToSource.get(entityKey) : null;
    if (!source) {
      flags.push({ id: row.id, status: 'no_mission_sheet', diffCount: null });
      continue;
    }
    const rd = row.rowData && typeof row.rowData === 'object' ? row.rowData : {};
    const preVal = rd.preArrivalGroupNumber;
    if (preVal == null || String(preVal).trim() === '') {
      flags.push({ id: row.id, status: 'no_pre_key', diffCount: null });
      continue;
    }
    const preKey = normPreArrivalKey(preVal);
    const sp = sourceIdToPayload.get(source.id);
    if (!sp || !sp.ok) {
      flags.push({ id: row.id, status: 'sheet_fetch_error', diffCount: null });
      continue;
    }
    const match = sp.byPre.get(preKey);
    if (!match) {
      flags.push({ id: row.id, status: 'no_sheet_row', diffCount: null });
      continue;
    }
    const merged = mergeNusukRowForPilgrimCompare(row);
    const rc = buildRowCompare(match.rowData, merged, sp.headers, match.raw);
    const diffCount = rc.comparedFields.filter((f) => f.status === 'diff').length;
    flags.push({
      id: row.id,
      status: rc.allComparedMatch ? 'match' : 'mismatch',
      diffCount,
    });
  }

  return { flags };
}

async function getPilgrimCompanyDataOverview() {
  const sources = await listAll();
  let nusukRowMap;
  try {
    nusukRowMap = await buildNusukPreArrivalRowMap();
  } catch (e) {
    return {
      nusukError: e?.message || 'Nusuk load failed',
      globalSummary: null,
      sources: [],
    };
  }

  const nusukDistinctKeys = nusukRowMap.size;
  const companyLookup = await loadPilgrimCompanyLookupMap();
  const payloads = await Promise.all(
    sources.map(async (source) => {
      try {
        const rawRows = await fetchCsvRows(source.sheetUrl);
        const { headers, stats, rows } = buildPreviewPayloadFromRawRows(source, rawRows, nusukRowMap, companyLookup);
        return {
          source: { id: source.id, name: source.name },
          resolvedUrl: source.sheetUrl,
          headers,
          stats,
          rows,
          fetchError: null,
        };
      } catch (e) {
        return {
          source: { id: source.id, name: source.name },
          resolvedUrl: source.sheetUrl,
          headers: [],
          stats: null,
          rows: [],
          fetchError: e?.message || 'Failed to fetch sheet',
        };
      }
    }),
  );

  let totalSheetRows = 0;
  let totalRowsWithKey = 0;
  let totalMatchedInNusuk = 0;
  let totalNotInNusuk = 0;
  let totalRowsWithoutKey = 0;
  let totalFieldDiffRows = 0;

  for (const p of payloads) {
    if (!p.stats) continue;
    totalSheetRows += p.stats.sheetRowCount;
    totalRowsWithKey += p.stats.rowsWithKey;
    totalMatchedInNusuk += p.stats.matchedInNusuk;
    totalNotInNusuk += p.stats.notInNusuk;
    totalRowsWithoutKey += p.stats.rowsWithoutPreArrivalKey ?? 0;
    totalFieldDiffRows += p.stats.matchedRowsWithFieldDiffs ?? 0;
  }

  return {
    nusukError: null,
    globalSummary: {
      sheetSourceCount: sources.length,
      totalSheetRows,
      totalRowsWithPreArrivalKey: totalRowsWithKey,
      /** Sheet rows whose رقم مجموعة الاستعداد المسبق matches a Nusuk row (same normalized key). */
      matchedPreArrivalKeyInNusuk: totalMatchedInNusuk,
      /** Sheet rows with a pre-arrival key but no matching Nusuk row. */
      sheetKeyNotInNusuk: totalNotInNusuk,
      rowsWithoutPreArrivalKey: totalRowsWithoutKey,
      /** Rows matched in Nusuk but at least one overlapping column differs. */
      matchedRowsWithFieldDiffs: totalFieldDiffRows,
      nusukDistinctKeys,
    },
    sources: payloads,
  };
}

module.exports = {
  MAX_SHEETS,
  normalizeGoogleSheetUrl,
  listAll,
  createSheet,
  updateSheet,
  deleteSheet,
  getPreviewForSource,
  getPilgrimCompanyDataOverview,
  getReceptionNusukRowsSummary,
  getReceptionDashboardStats,
  getReceptionDashboardPortBreakdown,
  getNusukSheetCompareFlags,
  getPilgrimSheetSuggestionsForNusukRow,
  applyFieldFromPilgrimSheetToNusuk,
  applyAllEmptyFieldsFromPilgrimSheetToNusuk,
};
