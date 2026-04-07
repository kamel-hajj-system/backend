/**
 * One-time (or safe to re-run): dedupe «رقم مجموعة الاستعداد المسبق» in rowData,
 * set pre_arrival_group_key from rowData. Run AFTER migration that adds the column,
 * BEFORE migration that adds UNIQUE index.
 *
 *   cd Backend && node scripts/backfill-nusuk-pre-arrival-group-key.js
 */
const { prisma } = require('../modules/users/models');
const { computePreArrivalGroupKey } = require('../modules/nusuk/nusukColumnMap');

async function main() {
  const rows = await prisma.nusukSheetRow.findMany({ orderBy: { sheetRowNumber: 'asc' } });
  const byKey = new Map();
  for (const r of rows) {
    const k = computePreArrivalGroupKey(r.rowData);
    if (!k) continue;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  }
  for (const [, list] of byKey) {
    if (list.length <= 1) continue;
    list.sort((a, b) => a.sheetRowNumber - b.sheetRowNumber);
    const [, ...losers] = list;
    for (const row of losers) {
      const rd =
        row.rowData && typeof row.rowData === 'object' ? { ...row.rowData } : {};
      delete rd.preArrivalGroupNumber;
      await prisma.nusukSheetRow.update({
        where: { id: row.id },
        data: { rowData: rd, preArrivalGroupKey: null },
      });
    }
  }
  const again = await prisma.nusukSheetRow.findMany({ orderBy: { sheetRowNumber: 'asc' } });
  for (const r of again) {
    const k = computePreArrivalGroupKey(r.rowData);
    await prisma.nusukSheetRow.update({
      where: { id: r.id },
      data: { preArrivalGroupKey: k },
    });
  }
  console.log('backfill-nusuk-pre-arrival-group-key: ok, rows=', again.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
