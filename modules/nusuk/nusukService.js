const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const { prisma } = require('../users/models');
const { getTableColumnsConfig: getServiceCenterPreArrivalTableColumnsConfig } = require('../service-center-pre-arrival/serviceCenterPreArrivalService');
const {
  NUSK_HEADER_TO_KEY,
  mapRawRowToRowData,
  isMeaningfulRow,
  parsePilgrimsCount,
  normEntityName,
  normServiceCenterCode,
  val,
  computePreArrivalGroupKey,
  isEmptyLikeCellValue,
} = require('./nusukColumnMap');

function buildCompanyLookup(companies) {
  const byExact = new Map();
  for (const c of companies) {
    const k = normEntityName(c.name);
    if (k && !byExact.has(k)) byExact.set(k, c);
  }
  return byExact;
}

function compareCounts(pilgrimsCount, expected) {
  if (expected == null) {
    return { status: 'no_company', nusukCount: pilgrimsCount, expectedCount: null, delta: null };
  }
  if (pilgrimsCount == null) {
    return {
      status: 'missing_nusuk_count',
      nusukCount: null,
      expectedCount: expected,
      delta: null,
    };
  }
  const delta = pilgrimsCount - expected;
  return {
    status: delta === 0 ? 'match' : 'mismatch',
    nusukCount: pilgrimsCount,
    expectedCount: expected,
    delta,
  };
}

/** One row per PilgrimCompany with expected vs Nusuk totals (all partners in the system). */
function buildCompanyBreakdown(allCompanies, dbNusukRows, companyLookup) {
  const stats = new Map();
  for (const r of dbNusukRows) {
    const nameKey = normEntityName(r.entityName);
    const company = nameKey ? companyLookup.get(nameKey) : null;
    if (!company) continue;
    if (!stats.has(company.id)) {
      stats.set(company.id, { sum: 0, rowCount: 0 });
    }
    const s = stats.get(company.id);
    s.rowCount += 1;
    const n = r.pilgrimsCount;
    if (n != null && Number.isFinite(Number(n))) {
      s.sum += Number(n);
    }
  }

  return allCompanies
    .map((c) => {
      const st = stats.get(c.id);
      const entered = st?.sum ?? 0;
      const expected = Number(c.expectedPilgrimsCount) || 0;
      const remaining = expected - entered;
      const percent = expected > 0 ? Math.round((entered / expected) * 1000) / 10 : null;
      return {
        id: c.id,
        name: c.name,
        nameAr: c.nameAr,
        externalCode: c.externalCode,
        expectedPilgrimsCount: expected,
        nusukEntered: entered,
        nusukRowCount: st?.rowCount ?? 0,
        remaining,
        percent,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function enrichRow(dbRow, companyLookup) {
  const nameKey = normEntityName(dbRow.entityName);
  const company = nameKey ? companyLookup.get(nameKey) : null;
  const expected = company?.expectedPilgrimsCount ?? null;
  const countComparison = compareCounts(dbRow.pilgrimsCount, expected);
  return {
    id: dbRow.id,
    sheetRowNumber: dbRow.sheetRowNumber,
    entityName: dbRow.entityName,
    pilgrimsCount: dbRow.pilgrimsCount,
    preArrivalGroupKey: dbRow.preArrivalGroupKey ?? null,
    rowData: dbRow.rowData,
    arrivalFlightConfirmed: dbRow.arrivalFlightConfirmed ?? null,
    actualArrivalStatus: dbRow.actualArrivalStatus ?? null,
    actualArrivalCount: dbRow.actualArrivalCount ?? null,
    serviceCenterNote: dbRow.serviceCenterNote ?? null,
    createdAt: dbRow.createdAt,
    updatedAt: dbRow.updatedAt,
    lastEditedInAppAt: dbRow.lastEditedInAppAt ?? null,
    pilgrimCompany: company
      ? {
          id: company.id,
          name: company.name,
          nameAr: company.nameAr,
          externalCode: company.externalCode,
          expectedPilgrimsCount: company.expectedPilgrimsCount,
        }
      : null,
    countComparison,
  };
}

async function fetchCsvRows(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`Sheet fetch failed (${res.status})`);
    if (/<!doctype html/i.test(text) || /<html/i.test(text)) {
      throw new Error('URL did not return CSV (check sharing and gid)');
    }
    return parse(text, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true });
  } finally {
    clearTimeout(timeout);
  }
}

async function getOrCreateSettings() {
  let s = await prisma.nusukSettings.findUnique({ where: { id: 'default' } });
  if (!s) {
    s = await prisma.nusukSettings.create({ data: { id: 'default', sheetCsvUrl: null } });
  }
  return s;
}

/** Sheet URL: optional one-off override (superadmin), else DB only — no env / hardcoded default. */
async function getResolvedSheetUrl(urlOverride) {
  const o = urlOverride && String(urlOverride).trim();
  if (o) return o;
  const s = await getOrCreateSettings();
  const fromDb = s.sheetCsvUrl?.trim();
  if (fromDb) return fromDb;
  return null;
}

async function buildSnapshotPayload() {
  const rows = await prisma.nusukSheetRow.findMany({ orderBy: { sheetRowNumber: 'asc' } });
  return rows.map((r) => ({
    sheetRowNumber: r.sheetRowNumber,
    entityName: r.entityName,
    pilgrimsCount: r.pilgrimsCount,
    preArrivalGroupKey: r.preArrivalGroupKey ?? null,
    rowData: r.rowData,
    arrivalFlightConfirmed: r.arrivalFlightConfirmed ?? null,
    actualArrivalStatus: r.actualArrivalStatus ?? null,
    actualArrivalCount: r.actualArrivalCount ?? null,
    serviceCenterNote: r.serviceCenterNote ?? null,
  }));
}

async function pruneSnapshots(maxKeep) {
  const toRemove = await prisma.nusukSyncSnapshot.findMany({
    orderBy: { createdAt: 'desc' },
    skip: maxKeep,
    select: { id: true },
  });
  if (!toRemove.length) return;
  await prisma.nusukSyncSnapshot.deleteMany({ where: { id: { in: toRemove.map((x) => x.id) } } });
}

async function saveSnapshotAfterSync({
  sourceUrl,
  imported,
  skippedAlreadyPresent,
  skippedDuplicatePreArrival = 0,
  parsedFromSheet,
}) {
  const snapshotData = await buildSnapshotPayload();
  const dupPart = skippedDuplicatePreArrival ? `, ${skippedDuplicatePreArrival} duplicate pre-arrival key skipped` : '';
  const label = `Sync +${imported} new, ${skippedAlreadyPresent} line skipped${dupPart}`;
  await prisma.nusukSyncSnapshot.create({
    data: {
      kind: 'auto',
      label,
      sourceUrl: sourceUrl || null,
      rowCount: snapshotData.length,
      snapshotData,
      meta: { imported, skippedAlreadyPresent, skippedDuplicatePreArrival, parsedFromSheet },
    },
  });
  await pruneSnapshots(45);
}

function parseSheetRows(rawRows) {
  const parsed = [];
  rawRows.forEach((raw, idx) => {
    const sheetRowNumber = idx + 2;
    const rowData = mapRawRowToRowData(raw);
    if (!isMeaningfulRow(rowData)) return;
    const entityName = normEntityName(rowData.entityName);
    if (!entityName) return;
    const pilgrimsCount = parsePilgrimsCount(rowData);
    parsed.push({
      sheetRowNumber,
      entityName,
      pilgrimsCount,
      rowData,
    });
  });
  return parsed;
}

async function getExistingSheetRowNumbers() {
  const existingRows = await prisma.nusukSheetRow.findMany({
    select: { sheetRowNumber: true },
  });
  return new Set(existingRows.map((r) => r.sheetRowNumber));
}

async function getExistingPreArrivalGroupKeys() {
  const rows = await prisma.nusukSheetRow.findMany({
    where: { preArrivalGroupKey: { not: null } },
    select: { preArrivalGroupKey: true },
  });
  return new Set(rows.map((r) => r.preArrivalGroupKey).filter(Boolean));
}

async function assertNoPreArrivalKeyConflict(key, excludeRowId) {
  if (!key) return;
  const other = await prisma.nusukSheetRow.findFirst({
    where: {
      preArrivalGroupKey: key,
      ...(excludeRowId ? { id: { not: excludeRowId } } : {}),
    },
    select: { sheetRowNumber: true },
  });
  if (other) {
    const err = new Error(
      `رقم مجموعة الاستعداد المسبق is already used by sheet row ${other.sheetRowNumber}`,
    );
    err.statusCode = 409;
    err.code = 'DUPLICATE_PRE_ARRIVAL_GROUP_KEY';
    throw err;
  }
}

async function syncFromSheet({ urlOverride, skipAutoSnapshot } = {}) {
  const url = await getResolvedSheetUrl(urlOverride);
  if (!url) {
    const err = new Error(
      'Nusuk Google Sheet URL is not configured. Add the CSV export URL in Super Admin → Nusuk data.',
    );
    err.code = 'NUSUK_SHEET_NOT_CONFIGURED';
    throw err;
  }
  const rawRows = await fetchCsvRows(url);
  const parsed = parseSheetRows(rawRows);
  const existingSheetRows = await getExistingSheetRowNumbers();
  const existingPreKeys = await getExistingPreArrivalGroupKeys();
  const candidates = parsed.filter((p) => !existingSheetRows.has(p.sheetRowNumber));
  const batchKeys = new Set();
  let skippedDuplicatePreArrival = 0;
  const toCreate = [];
  for (const p of candidates) {
    const preKey = computePreArrivalGroupKey(p.rowData);
    if (preKey && (existingPreKeys.has(preKey) || batchKeys.has(preKey))) {
      skippedDuplicatePreArrival += 1;
      continue;
    }
    if (preKey) batchKeys.add(preKey);
    toCreate.push({
      ...p,
      preArrivalGroupKey: preKey,
    });
  }

  if (toCreate.length) {
    await prisma.nusukSheetRow.createMany({ data: toCreate });
  }

  const companies = await prisma.pilgrimCompany.findMany({
    select: { id: true, name: true, nameAr: true, externalCode: true, expectedPilgrimsCount: true },
    orderBy: { name: 'asc' },
  });
  const lookup = buildCompanyLookup(companies);
  const rows = await prisma.nusukSheetRow.findMany({ orderBy: { sheetRowNumber: 'asc' } });
  const companyBreakdown = buildCompanyBreakdown(companies, rows, lookup);

  const imported = toCreate.length;
  const skippedAlreadyPresent = parsed.length - candidates.length;

  if (!skipAutoSnapshot) {
    await saveSnapshotAfterSync({
      sourceUrl: url,
      imported,
      skippedAlreadyPresent,
      skippedDuplicatePreArrival,
      parsedFromSheet: parsed.length,
    });
  }

  return {
    sourceUrl: url,
    imported,
    skippedAlreadyPresent,
    skippedDuplicatePreArrival,
    parsedFromSheet: parsed.length,
    rows: rows.map((r) => enrichRow(r, lookup)),
    companyBreakdown,
  };
}

async function previewSyncFromSheet({ urlOverride } = {}) {
  const url = await getResolvedSheetUrl(urlOverride);
  if (!url) {
    const err = new Error(
      'Nusuk Google Sheet URL is not configured. Add the CSV export URL in Super Admin → Nusuk data.',
    );
    err.code = 'NUSUK_SHEET_NOT_CONFIGURED';
    throw err;
  }

  const rawRows = await fetchCsvRows(url);
  const parsed = parseSheetRows(rawRows);
  const existingSheetRows = await getExistingSheetRowNumbers();
  const existingPreKeys = await getExistingPreArrivalGroupKeys();
  const candidates = parsed.filter((p) => !existingSheetRows.has(p.sheetRowNumber));
  const batchKeys = new Set();
  let skippedDuplicatePreArrival = 0;
  const pendingRows = [];
  for (const p of candidates) {
    const preKey = computePreArrivalGroupKey(p.rowData);
    if (preKey && (existingPreKeys.has(preKey) || batchKeys.has(preKey))) {
      skippedDuplicatePreArrival += 1;
      continue;
    }
    if (preKey) batchKeys.add(preKey);
    pendingRows.push(p);
  }

  return {
    sourceUrl: url,
    parsedFromSheet: parsed.length,
    skippedAlreadyPresent: parsed.length - candidates.length,
    skippedDuplicatePreArrival,
    pendingImported: pendingRows.length,
    pendingRows,
  };
}

async function saveSyncedRows({ rows, sourceUrl, parsedFromSheet, skippedAlreadyPresent, skipAutoSnapshot } = {}) {
  const incoming = Array.isArray(rows) ? rows : [];
  const normalized = incoming
    .map((r) => ({
      sheetRowNumber: Number(r?.sheetRowNumber),
      entityName: normEntityName(r?.entityName),
      pilgrimsCount: r?.pilgrimsCount == null ? null : Number(r.pilgrimsCount),
      rowData: r?.rowData && typeof r.rowData === 'object' ? r.rowData : {},
    }))
    .filter((r) => Number.isInteger(r.sheetRowNumber) && r.sheetRowNumber > 0 && r.entityName);

  const existingSheetRows = await getExistingSheetRowNumbers();
  const existingPreKeys = await getExistingPreArrivalGroupKeys();
  const candidates = normalized.filter((r) => !existingSheetRows.has(r.sheetRowNumber));
  const batchKeys = new Set();
  let skippedDuplicatePreArrival = 0;
  const toCreate = [];
  for (const r of candidates) {
    const preKey = computePreArrivalGroupKey(r.rowData);
    if (preKey && (existingPreKeys.has(preKey) || batchKeys.has(preKey))) {
      skippedDuplicatePreArrival += 1;
      continue;
    }
    if (preKey) batchKeys.add(preKey);
    toCreate.push({
      ...r,
      preArrivalGroupKey: preKey,
    });
  }

  if (toCreate.length) {
    await prisma.nusukSheetRow.createMany({ data: toCreate });
  }

  const imported = toCreate.length;
  if (!skipAutoSnapshot) {
    await saveSnapshotAfterSync({
      sourceUrl: sourceUrl || null,
      imported,
      skippedAlreadyPresent:
        skippedAlreadyPresent == null ? Math.max(0, normalized.length - candidates.length) : Number(skippedAlreadyPresent) || 0,
      skippedDuplicatePreArrival,
      parsedFromSheet: parsedFromSheet == null ? normalized.length : Number(parsedFromSheet) || normalized.length,
    });
  }

  const list = await listRows();
  return {
    ...list,
    sourceUrl: sourceUrl || null,
    imported,
    skippedAlreadyPresent:
      skippedAlreadyPresent == null ? Math.max(0, normalized.length - candidates.length) : Number(skippedAlreadyPresent) || 0,
    skippedDuplicatePreArrival,
    parsedFromSheet: parsedFromSheet == null ? normalized.length : Number(parsedFromSheet) || normalized.length,
  };
}

async function listRows() {
  const settings = await getOrCreateSettings();
  const companies = await prisma.pilgrimCompany.findMany({
    select: { id: true, name: true, nameAr: true, externalCode: true, expectedPilgrimsCount: true },
    orderBy: { name: 'asc' },
  });
  const lookup = buildCompanyLookup(companies);
  const rows = await prisma.nusukSheetRow.findMany({ orderBy: { sheetRowNumber: 'asc' } });
  const lastSyncedAt =
    rows.length > 0
      ? rows.reduce((max, r) => (r.updatedAt > max ? r.updatedAt : max), rows[0].updatedAt)
      : null;
  const companyBreakdown = buildCompanyBreakdown(companies, rows, lookup);
  const hasConfiguredSheetUrl = Boolean(settings.sheetCsvUrl?.trim());
  return {
    lastSyncedAt,
    rowCount: rows.length,
    rows: rows.map((r) => enrichRow(r, lookup)),
    companyBreakdown,
    integration: {
      hasConfiguredSheetUrl,
      /** UI: «رقم مجموعة الاستعداد المسبق» is stored normalized and must be unique per row when set. */
      preArrivalGroupNumberUnique: true,
    },
  };
}

/**
 * Nusuk rows where `rowData.serviceCenterCode` matches the given ServiceCenter's `code`
 * (same value as sheet column "رقم مركز الخدمة").
 */
async function listRowsForServiceCenter(serviceCenterId) {
  const settings = await getOrCreateSettings();
  const companies = await prisma.pilgrimCompany.findMany({
    select: { id: true, name: true, nameAr: true, externalCode: true, expectedPilgrimsCount: true },
    orderBy: { name: 'asc' },
  });
  const lookup = buildCompanyLookup(companies);

  const center = await prisma.serviceCenter.findUnique({
    where: { id: serviceCenterId },
    select: { id: true, code: true, name: true, nameAr: true },
  });
  if (!center) {
    const err = new Error('Service center not found');
    err.statusCode = 404;
    throw err;
  }

  const targetCode = normServiceCenterCode(center.code);
  const allRows = await prisma.nusukSheetRow.findMany({ orderBy: { sheetRowNumber: 'asc' } });
  const rows = allRows.filter((r) => {
    const rd = r.rowData && typeof r.rowData === 'object' ? r.rowData : {};
    const inSheet = normServiceCenterCode(rd.serviceCenterCode);
    return inSheet === targetCode;
  });

  const lastSyncedAt =
    rows.length > 0
      ? rows.reduce((max, r) => (r.updatedAt > max ? r.updatedAt : max), rows[0].updatedAt)
      : null;
  const companyBreakdown = buildCompanyBreakdown(companies, rows, lookup);
  const columnsConfig = await getServiceCenterPreArrivalTableColumnsConfig();

  const allocatedAgg = await prisma.serviceCenterPilgrimCompany.aggregate({
    where: { serviceCenterId },
    _sum: { allocatedPilgrims: true },
  });
  const totalPilgrimsAllocated = allocatedAgg._sum.allocatedPilgrims ?? 0;

  return {
    serviceCenter: {
      id: center.id,
      code: center.code,
      name: center.name,
      nameAr: center.nameAr,
    },
    /** Sum of `allocated_pilgrims` for this center (بعثات ↔ مركز الخدمة). Not derived from Nusuk rows. */
    totalPilgrimsAllocated,
    lastSyncedAt,
    rowCount: rows.length,
    rows: rows.map((r) => enrichRow(r, lookup)),
    companyBreakdown,
    columnsConfig,
    integration: {
      hasConfiguredSheetUrl: Boolean(settings.sheetCsvUrl?.trim()),
      preArrivalGroupNumberUnique: true,
    },
  };
}

function pilgrimsCountOfNusukRow(r) {
  const pc = r.pilgrimsCount;
  return pc != null && Number.isFinite(Number(pc)) ? Number(pc) : 0;
}

/** Aligns with reception / pilgrim-company overviews for actual arrival weight per row. */
function actualArrivalContributionFromNusukRowLite(r) {
  const st = r.actualArrivalStatus;
  const pc = pilgrimsCountOfNusukRow(r);
  const acRaw = r.actualArrivalCount;
  const ac = acRaw != null && Number.isFinite(Number(acRaw)) ? Number(acRaw) : null;
  if (st === 'yes') return ac != null ? ac : pc;
  if (st === 'partial') return ac != null ? ac : 0;
  return 0;
}

/**
 * Service center home: totals without returning full Nusuk rows.
 * - `preArrivalConfirmedPilgrims`: Σ `pilgrimsCount` where `arrivalFlightConfirmed === true`.
 * - `actualArrivalTotal`: Σ contribution from `actualArrivalStatus` / `actualArrivalCount` (same rules as reception).
 */
async function getServiceCenterDashboardSummary(serviceCenterId) {
  const center = await prisma.serviceCenter.findUnique({
    where: { id: serviceCenterId },
    select: { id: true, code: true },
  });
  if (!center) {
    const err = new Error('Service center not found');
    err.statusCode = 404;
    throw err;
  }

  const targetCode = normServiceCenterCode(center.code);
  const allRows = await prisma.nusukSheetRow.findMany({
    select: {
      pilgrimsCount: true,
      actualArrivalStatus: true,
      actualArrivalCount: true,
      arrivalFlightConfirmed: true,
      rowData: true,
    },
    orderBy: { sheetRowNumber: 'asc' },
  });

  const rows = allRows.filter((r) => {
    const rd = r.rowData && typeof r.rowData === 'object' ? r.rowData : {};
    return normServiceCenterCode(rd.serviceCenterCode) === targetCode;
  });

  const allocatedAgg = await prisma.serviceCenterPilgrimCompany.aggregate({
    where: { serviceCenterId },
    _sum: { allocatedPilgrims: true },
  });
  const totalPilgrimsAllocated = allocatedAgg._sum.allocatedPilgrims ?? 0;

  let preArrivalConfirmedPilgrims = 0;
  let actualArrivalSum = 0;
  for (const r of rows) {
    if (r.arrivalFlightConfirmed === true) {
      preArrivalConfirmedPilgrims += pilgrimsCountOfNusukRow(r);
    }
    actualArrivalSum += actualArrivalContributionFromNusukRowLite(r);
  }

  const actualArrivalTotal = Math.round(actualArrivalSum);
  const actualVsAllocatedPercent =
    totalPilgrimsAllocated > 0
      ? Math.min(100, Math.round((actualArrivalTotal / totalPilgrimsAllocated) * 100))
      : actualArrivalTotal > 0
        ? 100
        : 0;

  return {
    totalPilgrimsAllocated,
    preArrivalConfirmedPilgrims,
    actualArrivalTotal,
    actualVsAllocatedPercent,
    nusukRowCount: rows.length,
  };
}

/** Best-effort sort key for sheet «تاريخ القدوم» strings (ISO, DD/MM/YYYY, etc.). */
function parseArrivalDateLabelForSort(label) {
  const s = String(label ?? '').trim();
  if (!s) return null;
  const direct = Date.parse(s);
  if (!Number.isNaN(direct)) return direct;
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) {
    return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }
  const m2 = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m2) {
    return Date.UTC(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
  }
  return null;
}

/**
 * For service center home line chart: Σ pilgrims per `rowData.arrivalDate` where `arrivalFlightConfirmed` is true.
 */
async function getServiceCenterPreArrivalByArrivalDate(serviceCenterId) {
  const center = await prisma.serviceCenter.findUnique({
    where: { id: serviceCenterId },
    select: { id: true, code: true },
  });
  if (!center) {
    const err = new Error('Service center not found');
    err.statusCode = 404;
    throw err;
  }

  const targetCode = normServiceCenterCode(center.code);
  const allRows = await prisma.nusukSheetRow.findMany({
    select: {
      pilgrimsCount: true,
      arrivalFlightConfirmed: true,
      rowData: true,
    },
    orderBy: { sheetRowNumber: 'asc' },
  });

  const rows = allRows.filter((r) => {
    const rd = r.rowData && typeof r.rowData === 'object' ? r.rowData : {};
    return normServiceCenterCode(rd.serviceCenterCode) === targetCode;
  });

  const bucket = new Map();
  for (const r of rows) {
    if (r.arrivalFlightConfirmed !== true) continue;
    const rd = r.rowData && typeof r.rowData === 'object' ? r.rowData : {};
    const raw = rd.arrivalDate;
    if (raw == null || isEmptyLikeCellValue(raw)) continue;
    let label = String(raw).trim();
    try {
      label = label.normalize('NFC');
    } catch {
      /* ignore */
    }
    if (!label) continue;
    const p = pilgrimsCountOfNusukRow(r);
    bucket.set(label, (bucket.get(label) || 0) + p);
  }

  const series = [...bucket.entries()].map(([dateLabel, pilgrims]) => ({
    dateLabel,
    pilgrims: Math.round(pilgrims * 100) / 100,
  }));

  series.sort((a, b) => {
    const ta = parseArrivalDateLabelForSort(a.dateLabel);
    const tb = parseArrivalDateLabelForSort(b.dateLabel);
    if (ta != null && tb != null) return ta - tb;
    if (ta != null) return -1;
    if (tb != null) return 1;
    return a.dateLabel.localeCompare(b.dateLabel, 'ar');
  });

  return { series };
}

/**
 * Single Nusuk row for service center portal (must match center code). Includes `columnsConfig` for detail UI.
 */
async function getRowForServiceCenter(serviceCenterId, rowId) {
  const center = await prisma.serviceCenter.findUnique({
    where: { id: serviceCenterId },
    select: { id: true, code: true, name: true, nameAr: true },
  });
  if (!center) {
    const err = new Error('Service center not found');
    err.statusCode = 404;
    throw err;
  }
  const existing = await prisma.nusukSheetRow.findUnique({ where: { id: rowId } });
  if (!existing) return null;

  const rd = existing.rowData && typeof existing.rowData === 'object' ? existing.rowData : {};
  if (normServiceCenterCode(rd.serviceCenterCode) !== normServiceCenterCode(center.code)) {
    const err = new Error('This row is not assigned to your service center');
    err.statusCode = 403;
    err.code = 'ROW_NOT_IN_YOUR_CENTER';
    throw err;
  }

  const companies = await prisma.pilgrimCompany.findMany({
    select: { id: true, name: true, nameAr: true, externalCode: true, expectedPilgrimsCount: true },
  });
  const lookup = buildCompanyLookup(companies);
  const columnsConfig = await getServiceCenterPreArrivalTableColumnsConfig();
  const settings = await getOrCreateSettings();

  return {
    row: enrichRow(existing, lookup),
    serviceCenter: center,
    columnsConfig,
    integration: {
      hasConfiguredSheetUrl: Boolean(settings.sheetCsvUrl?.trim()),
    },
  };
}

function assertExpectedUpdatedAt(existing, expectedUpdatedAt) {
  if (expectedUpdatedAt == null || expectedUpdatedAt === '') {
    const err = new Error('expectedUpdatedAt is required');
    err.statusCode = 400;
    err.code = 'EXPECTED_UPDATED_AT_REQUIRED';
    throw err;
  }
  const parsed = new Date(expectedUpdatedAt);
  if (Number.isNaN(parsed.getTime())) {
    const err = new Error('expectedUpdatedAt must be a valid ISO date');
    err.statusCode = 400;
    err.code = 'INVALID_EXPECTED_UPDATED_AT';
    throw err;
  }
  const serverMs =
    existing.updatedAt instanceof Date
      ? existing.updatedAt.getTime()
      : new Date(existing.updatedAt).getTime();
  if (serverMs !== parsed.getTime()) {
    const err = new Error(
      'This row was changed elsewhere. Reload the row and try again if you still need to edit.'
    );
    err.statusCode = 409;
    err.code = 'STALE_ROW';
    throw err;
  }
}

const EDIT_LOCK_TTL_MS = 3 * 60 * 1000;

async function assertEditLockForSave(tx, rowId, userId, lockToken) {
  if (!lockToken) {
    const err = new Error('lockToken is required');
    err.statusCode = 400;
    err.code = 'LOCK_TOKEN_REQUIRED';
    throw err;
  }
  const lock = await tx.nusukSheetRowEditLock.findUnique({ where: { rowId } });
  const now = new Date();
  if (!lock || lock.expiresAt <= now) {
    const err = new Error('Edit lock expired or missing. Close and open the row again.');
    err.statusCode = 409;
    err.code = 'LOCK_LOST';
    throw err;
  }
  if (lock.userId !== userId || lock.lockToken !== lockToken) {
    const err = new Error('Invalid edit lock.');
    err.statusCode = 403;
    err.code = 'LOCK_MISMATCH';
    throw err;
  }
}

/** @returns {Promise<{ lockToken: string, expiresAt: Date } | null>} null if row missing */
async function acquireEditLock(rowId, userId) {
  const row = await prisma.nusukSheetRow.findUnique({ where: { id: rowId } });
  if (!row) return null;

  const now = new Date();
  const newExpiry = new Date(Date.now() + EDIT_LOCK_TTL_MS);

  const existing = await prisma.nusukSheetRowEditLock.findUnique({
    where: { rowId },
    include: { user: { select: { id: true, fullName: true, fullNameAr: true, email: true } } },
  });

  if (existing) {
    if (existing.expiresAt > now) {
      if (existing.userId === userId) {
        const updated = await prisma.nusukSheetRowEditLock.update({
          where: { rowId },
          data: { expiresAt: newExpiry },
        });
        return { lockToken: updated.lockToken, expiresAt: updated.expiresAt };
      }
      const err = new Error('Another user is editing this row.');
      err.statusCode = 409;
      err.code = 'ROW_LOCKED';
      err.lockedBy = {
        fullName: existing.user.fullName,
        fullNameAr: existing.user.fullNameAr,
        email: existing.user.email,
      };
      throw err;
    }
    await prisma.nusukSheetRowEditLock.delete({ where: { rowId } });
  }

  const lockToken = crypto.randomUUID();
  const created = await prisma.nusukSheetRowEditLock.create({
    data: { rowId, userId, lockToken, expiresAt: newExpiry },
  });
  return { lockToken: created.lockToken, expiresAt: created.expiresAt };
}

async function releaseEditLock(rowId, userId, lockToken) {
  if (!lockToken) {
    const err = new Error('lockToken is required');
    err.statusCode = 400;
    err.code = 'LOCK_TOKEN_REQUIRED';
    throw err;
  }
  const lock = await prisma.nusukSheetRowEditLock.findUnique({ where: { rowId } });
  if (!lock) return { released: true };
  if (lock.userId !== userId || lock.lockToken !== lockToken) {
    const err = new Error('Cannot release this lock');
    err.statusCode = 403;
    err.code = 'LOCK_MISMATCH';
    throw err;
  }
  await prisma.nusukSheetRowEditLock.delete({ where: { rowId } });
  return { released: true };
}

async function heartbeatEditLock(rowId, userId, lockToken) {
  if (!lockToken) {
    const err = new Error('lockToken is required');
    err.statusCode = 400;
    err.code = 'LOCK_TOKEN_REQUIRED';
    throw err;
  }
  const lock = await prisma.nusukSheetRowEditLock.findUnique({ where: { rowId } });
  const now = new Date();
  if (!lock || lock.expiresAt <= now) {
    const err = new Error('Edit lock expired.');
    err.statusCode = 409;
    err.code = 'LOCK_LOST';
    throw err;
  }
  if (lock.userId !== userId || lock.lockToken !== lockToken) {
    const err = new Error('Invalid edit lock.');
    err.statusCode = 403;
    err.code = 'LOCK_MISMATCH';
    throw err;
  }
  const updated = await prisma.nusukSheetRowEditLock.update({
    where: { rowId },
    data: { expiresAt: new Date(Date.now() + EDIT_LOCK_TTL_MS) },
  });
  return { expiresAt: updated.expiresAt };
}

function parseActualArrivalStatus(val) {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  const s = String(val).toLowerCase().trim();
  if (!['yes', 'no', 'partial'].includes(s)) {
    const err = new Error('actualArrivalStatus must be yes, no, partial, or null');
    err.statusCode = 400;
    err.code = 'INVALID_ACTUAL_ARRIVAL_STATUS';
    throw err;
  }
  return s;
}

function normServiceCenterNote(val) {
  if (val === undefined) return undefined;
  if (val === null) return null;
  const s = String(val).trim();
  if (!s) return null;
  return s.slice(0, 8000);
}

async function updateRow(id, data, { userId } = {}) {
  const existing = await prisma.nusukSheetRow.findUnique({ where: { id } });
  if (!existing) return null;

  assertExpectedUpdatedAt(existing, data.expectedUpdatedAt);

  const nextEntity = data.entityName !== undefined ? normEntityName(data.entityName) : existing.entityName;
  let nextRowData =
    existing.rowData && typeof existing.rowData === 'object'
      ? { ...existing.rowData }
      : {};
  if (data.rowData !== undefined && typeof data.rowData === 'object' && data.rowData !== null) {
    nextRowData = { ...nextRowData, ...data.rowData };
  }

  let nextPilgrims = existing.pilgrimsCount;
  if (data.pilgrimsCount !== undefined) {
    if (data.pilgrimsCount === null) {
      nextPilgrims = null;
      nextRowData.pilgrimsCount = '';
    } else {
      const n = Number(data.pilgrimsCount);
      nextPilgrims = Number.isFinite(n) ? Math.trunc(n) : null;
      nextRowData.pilgrimsCount = nextPilgrims != null ? String(nextPilgrims) : '';
    }
  } else if (data.rowData?.pilgrimsCount !== undefined) {
    nextPilgrims = parsePilgrimsCount(nextRowData);
  }

  if (data.entityName !== undefined) {
    nextRowData.entityName = nextEntity;
  }

  let nextArrivalFlight = existing.arrivalFlightConfirmed ?? null;
  if (data.arrivalFlightConfirmed !== undefined) {
    if (data.arrivalFlightConfirmed === null) nextArrivalFlight = null;
    else nextArrivalFlight = Boolean(data.arrivalFlightConfirmed);
  }

  let nextActualStatus = existing.actualArrivalStatus;
  const parsedStatus = parseActualArrivalStatus(data.actualArrivalStatus);
  if (parsedStatus !== undefined) {
    nextActualStatus = parsedStatus;
  }

  let nextActualCount = existing.actualArrivalCount;
  if (data.actualArrivalCount !== undefined) {
    if (data.actualArrivalCount === null || data.actualArrivalCount === '') {
      nextActualCount = null;
    } else {
      const n = Number(data.actualArrivalCount);
      if (!Number.isFinite(n) || n < 0) {
        const err = new Error('actualArrivalCount must be a non-negative integer or null');
        err.statusCode = 400;
        err.code = 'INVALID_ACTUAL_ARRIVAL_COUNT';
        throw err;
      }
      nextActualCount = Math.trunc(n);
    }
  }

  let nextServiceCenterNote = existing.serviceCenterNote ?? null;
  const parsedNote = normServiceCenterNote(data.serviceCenterNote);
  if (parsedNote !== undefined) {
    nextServiceCenterNote = parsedNote;
  }

  const nextPreArrivalKey = computePreArrivalGroupKey(nextRowData);
  const existingPreKey =
    existing.preArrivalGroupKey ?? computePreArrivalGroupKey(existing.rowData);
  if (nextPreArrivalKey !== existingPreKey) {
    await assertNoPreArrivalKeyConflict(nextPreArrivalKey, id);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await assertEditLockForSave(tx, id, userId, data.lockToken);
    const row = await tx.nusukSheetRow.update({
      where: { id },
      data: {
        entityName: nextEntity || existing.entityName,
        pilgrimsCount: nextPilgrims,
        rowData: nextRowData,
        preArrivalGroupKey: nextPreArrivalKey,
        arrivalFlightConfirmed: nextArrivalFlight,
        actualArrivalStatus: nextActualStatus,
        actualArrivalCount: nextActualCount,
        serviceCenterNote: nextServiceCenterNote,
        lastEditedInAppAt: new Date(),
      },
    });
    await tx.nusukSheetRowEditLock.deleteMany({ where: { rowId: id } });
    return row;
  });

  const companies = await prisma.pilgrimCompany.findMany({
    select: { id: true, name: true, nameAr: true, externalCode: true, expectedPilgrimsCount: true },
  });
  const lookup = buildCompanyLookup(companies);
  return enrichRow(updated, lookup);
}

/** Service center portal: arrival fields + optional sheet fields (`entityName`, `pilgrimsCount`, `rowData` merge). No edit lock. */
async function updateServiceCenterNusukRow(id, serviceCenterId, data) {
  const existing = await prisma.nusukSheetRow.findUnique({ where: { id } });
  if (!existing) return null;

  const center = await prisma.serviceCenter.findUnique({
    where: { id: serviceCenterId },
    select: { code: true },
  });
  if (!center) {
    const err = new Error('Service center not found');
    err.statusCode = 404;
    throw err;
  }
  const rd = existing.rowData && typeof existing.rowData === 'object' ? existing.rowData : {};
  if (normServiceCenterCode(rd.serviceCenterCode) !== normServiceCenterCode(center.code)) {
    const err = new Error('This row is not assigned to your service center');
    err.statusCode = 403;
    err.code = 'ROW_NOT_IN_YOUR_CENTER';
    throw err;
  }

  assertExpectedUpdatedAt(existing, data.expectedUpdatedAt);

  let nextEntity = existing.entityName;
  let nextPilgrims = existing.pilgrimsCount;
  let nextRowData =
    existing.rowData && typeof existing.rowData === 'object' ? { ...existing.rowData } : {};

  if (data.entityName !== undefined) {
    nextEntity = normEntityName(data.entityName) || existing.entityName;
    nextRowData.entityName = nextEntity;
  }
  if (data.rowData !== undefined && typeof data.rowData === 'object' && data.rowData !== null) {
    nextRowData = { ...nextRowData, ...data.rowData };
  }
  if (data.pilgrimsCount !== undefined) {
    if (data.pilgrimsCount === null) {
      nextPilgrims = null;
      nextRowData.pilgrimsCount = '';
    } else {
      const n = Number(data.pilgrimsCount);
      nextPilgrims = Number.isFinite(n) ? Math.trunc(n) : null;
      nextRowData.pilgrimsCount = nextPilgrims != null ? String(nextPilgrims) : '';
    }
  } else if (data.rowData?.pilgrimsCount !== undefined) {
    nextPilgrims = parsePilgrimsCount(nextRowData);
  }

  let nextArrivalFlight = existing.arrivalFlightConfirmed ?? null;
  if (data.arrivalFlightConfirmed !== undefined) {
    if (data.arrivalFlightConfirmed === null) nextArrivalFlight = null;
    else nextArrivalFlight = Boolean(data.arrivalFlightConfirmed);
  }

  let nextActualStatus = existing.actualArrivalStatus;
  const scParsed = parseActualArrivalStatus(data.actualArrivalStatus);
  if (scParsed !== undefined) {
    nextActualStatus = scParsed;
  }

  let nextActualCount = existing.actualArrivalCount;
  if (data.actualArrivalCount !== undefined) {
    if (data.actualArrivalCount === null || data.actualArrivalCount === '') {
      nextActualCount = null;
    } else {
      const n = Number(data.actualArrivalCount);
      if (!Number.isFinite(n) || n < 0) {
        const err = new Error('actualArrivalCount must be a non-negative integer or null');
        err.statusCode = 400;
        err.code = 'INVALID_ACTUAL_ARRIVAL_COUNT';
        throw err;
      }
      nextActualCount = Math.trunc(n);
    }
  }

  let nextScNote = existing.serviceCenterNote ?? null;
  const scNoteParsed = normServiceCenterNote(data.serviceCenterNote);
  if (scNoteParsed !== undefined) {
    nextScNote = scNoteParsed;
  }

  const nextPreArrivalKeySc = computePreArrivalGroupKey(nextRowData);
  const existingPreKeySc =
    existing.preArrivalGroupKey ?? computePreArrivalGroupKey(existing.rowData);
  if (nextPreArrivalKeySc !== existingPreKeySc) {
    await assertNoPreArrivalKeyConflict(nextPreArrivalKeySc, id);
  }

  const updated = await prisma.nusukSheetRow.update({
    where: { id },
    data: {
      entityName: nextEntity || existing.entityName,
      pilgrimsCount: nextPilgrims,
      rowData: nextRowData,
      preArrivalGroupKey: nextPreArrivalKeySc,
      arrivalFlightConfirmed: nextArrivalFlight,
      actualArrivalStatus: nextActualStatus,
      actualArrivalCount: nextActualCount,
      serviceCenterNote: nextScNote,
      lastEditedInAppAt: new Date(),
    },
  });

  const companies = await prisma.pilgrimCompany.findMany({
    select: { id: true, name: true, nameAr: true, externalCode: true, expectedPilgrimsCount: true },
  });
  const lookup = buildCompanyLookup(companies);
  return enrichRow(updated, lookup);
}

async function getAdminSettings() {
  const s = await getOrCreateSettings();
  return {
    sheetCsvUrl: s.sheetCsvUrl || '',
    columnsConfig: s.columnsConfig && typeof s.columnsConfig === 'object' ? s.columnsConfig : {},
    updatedAt: s.updatedAt,
  };
}

async function updateAdminSettings({ sheetCsvUrl, columnsConfig }) {
  const url = sheetCsvUrl === null || sheetCsvUrl === undefined ? null : String(sheetCsvUrl).trim() || null;
  const nextColumnsConfig =
    columnsConfig !== undefined
      ? (columnsConfig && typeof columnsConfig === 'object' ? columnsConfig : {})
      : undefined;
  const s = await prisma.nusukSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', sheetCsvUrl: url, columnsConfig: nextColumnsConfig ?? {} },
    update: {
      sheetCsvUrl: url,
      ...(nextColumnsConfig !== undefined ? { columnsConfig: nextColumnsConfig } : {}),
    },
  });
  return {
    sheetCsvUrl: s.sheetCsvUrl || '',
    columnsConfig: s.columnsConfig && typeof s.columnsConfig === 'object' ? s.columnsConfig : {},
    updatedAt: s.updatedAt,
  };
}

async function getColumnsConfig() {
  const s = await getOrCreateSettings();
  return s.columnsConfig && typeof s.columnsConfig === 'object' ? s.columnsConfig : {};
}

async function updateColumnsConfig(columnsConfig) {
  const cfg = columnsConfig && typeof columnsConfig === 'object' ? columnsConfig : {};
  const s = await prisma.nusukSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', sheetCsvUrl: null, columnsConfig: cfg },
    update: { columnsConfig: cfg },
  });
  return s.columnsConfig && typeof s.columnsConfig === 'object' ? s.columnsConfig : {};
}

async function listSnapshots() {
  const rows = await prisma.nusukSyncSnapshot.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      kind: true,
      label: true,
      sourceUrl: true,
      rowCount: true,
      meta: true,
    },
  });
  return rows;
}

async function createManualSnapshot({ label }) {
  const snapshotData = await buildSnapshotPayload();
  const row = await prisma.nusukSyncSnapshot.create({
    data: {
      kind: 'manual',
      label: label?.trim() || 'Manual backup',
      sourceUrl: null,
      rowCount: snapshotData.length,
      snapshotData,
      meta: null,
    },
  });
  await pruneSnapshots(45);
  return {
    id: row.id,
    createdAt: row.createdAt,
    kind: row.kind,
    label: row.label,
    rowCount: row.rowCount,
  };
}

async function restoreSnapshot(snapshotId) {
  const snap = await prisma.nusukSyncSnapshot.findUnique({ where: { id: snapshotId } });
  if (!snap) {
    const err = new Error('Snapshot not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const data = snap.snapshotData;
  if (!Array.isArray(data)) {
    const err = new Error('Invalid snapshot data');
    err.code = 'INVALID_SNAPSHOT';
    throw err;
  }
  const normalized = data.map((row) => {
    const rowData = row.rowData && typeof row.rowData === 'object' ? row.rowData : {};
    const preArrivalGroupKey = computePreArrivalGroupKey(rowData);
    return {
    sheetRowNumber: Number(row.sheetRowNumber),
    entityName: String(row.entityName || ''),
    pilgrimsCount: row.pilgrimsCount == null ? null : Number(row.pilgrimsCount),
    preArrivalGroupKey,
    rowData,
    arrivalFlightConfirmed:
      row.arrivalFlightConfirmed === undefined ? null : row.arrivalFlightConfirmed,
    actualArrivalStatus: row.actualArrivalStatus ?? null,
    actualArrivalCount:
      row.actualArrivalCount == null || row.actualArrivalCount === ''
        ? null
        : Number(row.actualArrivalCount),
    serviceCenterNote: row.serviceCenterNote != null && row.serviceCenterNote !== '' ? String(row.serviceCenterNote) : null,
  };
  });

  await prisma.$transaction(async (tx) => {
    await tx.nusukSheetRow.deleteMany({});
    if (normalized.length) {
      await tx.nusukSheetRow.createMany({ data: normalized });
    }
  });

  return listRows();
}

async function truncateAllRows() {
  await prisma.nusukSheetRow.deleteMany({});
  return { deleted: true };
}

const ROW_DATA_KEYS = new Set(Object.values(NUSK_HEADER_TO_KEY));

/**
 * Persist full merged rowData after batch pilgrim-sheet copy (only empty Nusuk cells filled server-side).
 * Recalculates entityName, pilgrimsCount, preArrivalGroupKey.
 */
async function applyPilgrimSheetRowDataMerge(nusukRowId, nextRowData) {
  if (!nextRowData || typeof nextRowData !== 'object') {
    const err = new Error('Invalid row data');
    err.statusCode = 400;
    throw err;
  }

  const existing = await prisma.nusukSheetRow.findUnique({ where: { id: nusukRowId } });
  if (!existing) return null;

  const nextEntity = normEntityName(nextRowData.entityName) || existing.entityName;
  const mergedRowData = { ...nextRowData, entityName: nextEntity };

  const nextPilgrims = parsePilgrimsCount(mergedRowData);
  const nextPreArrivalKeyApply = computePreArrivalGroupKey(mergedRowData);
  const existingPreKeyApply =
    existing.preArrivalGroupKey ?? computePreArrivalGroupKey(existing.rowData);
  if (nextPreArrivalKeyApply !== existingPreKeyApply) {
    await assertNoPreArrivalKeyConflict(nextPreArrivalKeyApply, nusukRowId);
  }

  const updated = await prisma.nusukSheetRow.update({
    where: { id: nusukRowId },
    data: {
      entityName: nextEntity,
      pilgrimsCount: nextPilgrims,
      rowData: mergedRowData,
      preArrivalGroupKey: nextPreArrivalKeyApply,
      lastEditedInAppAt: new Date(),
    },
  });

  const companies = await prisma.pilgrimCompany.findMany({
    select: { id: true, name: true, nameAr: true, externalCode: true, expectedPilgrimsCount: true },
  });
  const lookup = buildCompanyLookup(companies);
  return enrichRow(updated, lookup);
}

/**
 * Merge one field from pilgrim-company sheet into Nusuk rowData (no edit lock).
 * Used after server verifies the value against the published pilgrim CSV.
 */
async function applyPilgrimSheetFieldToNusukRow(nusukRowId, fieldKey, value, options = {}) {
  const overwrite = Boolean(options.overwrite);
  if (!ROW_DATA_KEYS.has(fieldKey)) {
    const err = new Error('Invalid field key');
    err.statusCode = 400;
    throw err;
  }
  const strVal = val(value);
  if (!strVal) {
    const err = new Error('Value is empty');
    err.statusCode = 400;
    throw err;
  }

  const existing = await prisma.nusukSheetRow.findUnique({ where: { id: nusukRowId } });
  if (!existing) return null;

  let nextRowData =
    existing.rowData && typeof existing.rowData === 'object' ? { ...existing.rowData } : {};
  if (!overwrite && !isEmptyLikeCellValue(nextRowData[fieldKey])) {
    const err = new Error('This field already has a value in Nusuk');
    err.statusCode = 409;
    err.code = 'NUSUK_FIELD_NOT_EMPTY';
    throw err;
  }

  nextRowData[fieldKey] = strVal;

  let nextEntity = existing.entityName;
  if (fieldKey === 'entityName') {
    nextEntity = normEntityName(strVal) || existing.entityName;
    nextRowData.entityName = nextEntity;
  }

  let nextPilgrims = existing.pilgrimsCount;
  if (fieldKey === 'pilgrimsCount') {
    nextPilgrims = parsePilgrimsCount(nextRowData);
  }

  const nextPreArrivalKeyApply = computePreArrivalGroupKey(nextRowData);
  const existingPreKeyApply =
    existing.preArrivalGroupKey ?? computePreArrivalGroupKey(existing.rowData);
  if (nextPreArrivalKeyApply !== existingPreKeyApply) {
    await assertNoPreArrivalKeyConflict(nextPreArrivalKeyApply, nusukRowId);
  }

  const updated = await prisma.nusukSheetRow.update({
    where: { id: nusukRowId },
    data: {
      entityName: nextEntity,
      pilgrimsCount: nextPilgrims,
      rowData: nextRowData,
      preArrivalGroupKey: nextPreArrivalKeyApply,
      lastEditedInAppAt: new Date(),
    },
  });

  const companies = await prisma.pilgrimCompany.findMany({
    select: { id: true, name: true, nameAr: true, externalCode: true, expectedPilgrimsCount: true },
  });
  const lookup = buildCompanyLookup(companies);
  return enrichRow(updated, lookup);
}

module.exports = {
  syncFromSheet,
  previewSyncFromSheet,
  saveSyncedRows,
  listRows,
  listRowsForServiceCenter,
  getServiceCenterDashboardSummary,
  getServiceCenterPreArrivalByArrivalDate,
  getRowForServiceCenter,
  acquireEditLock,
  releaseEditLock,
  heartbeatEditLock,
  updateRow,
  updateServiceCenterNusukRow,
  getResolvedSheetUrl,
  getOrCreateSettings,
  getAdminSettings,
  updateAdminSettings,
  getColumnsConfig,
  updateColumnsConfig,
  listSnapshots,
  createManualSnapshot,
  restoreSnapshot,
  truncateAllRows,
  applyPilgrimSheetFieldToNusukRow,
  applyPilgrimSheetRowDataMerge,
};
