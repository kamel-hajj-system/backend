-- Incremental Nusuk sync: one DB row per sheet line; skip sheet row numbers already stored.
CREATE UNIQUE INDEX "nusuk_sheet_rows_sheet_row_number_key" ON "nusuk_sheet_rows"("sheet_row_number");
