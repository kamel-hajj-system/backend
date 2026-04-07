-- Unique when set (multiple NULLs allowed in PostgreSQL).
CREATE UNIQUE INDEX IF NOT EXISTS "nusuk_sheet_rows_pre_arrival_group_key_key" ON "nusuk_sheet_rows"("pre_arrival_group_key");
