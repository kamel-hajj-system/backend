/**
 * Google Sheets: turn a share / edit URL into a CSV export URL the server can fetch.
 * Server-side fetch needs "Anyone with the link" (Viewer) or the response is HTML (login page).
 */

function normalizeGoogleSheetUrl(input) {
  const u = String(input).trim();
  if (!u) return null;
  if (!/^https:\/\/(docs\.google\.com|drive\.google\.com)\//i.test(u)) {
    return null;
  }
  if (u.includes('/export?') && /format=csv/i.test(u)) {
    return u.split('#')[0];
  }
  const m = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const sheetId = m[1];
  let gid = '0';
  const gidMatch = u.match(/[#&?]gid=(\d+)/);
  if (gidMatch) gid = gidMatch[1];
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

/** Google URLs → CSV export; any other http(s) URL returned as-is (custom CSV hosts). */
function resolveSheetCsvFetchUrl(input) {
  const u = String(input || '').trim();
  if (!u) return null;
  const normalized = normalizeGoogleSheetUrl(u);
  return normalized != null ? normalized : u;
}

/** Google often serves HTML (login/consent) to non-browser user agents; this reduces that in Node fetch. */
const GOOGLE_SHEET_CSV_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/csv,text/plain,*/*;q=0.9,*/*;q=0.8',
};

function sheetHtmlResponseHint(text) {
  const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!title) return '';
  const t = title[1].replace(/\s+/g, ' ').trim().slice(0, 160);
  return t ? ` (${t})` : '';
}

module.exports = {
  normalizeGoogleSheetUrl,
  resolveSheetCsvFetchUrl,
  GOOGLE_SHEET_CSV_FETCH_HEADERS,
  sheetHtmlResponseHint,
};
