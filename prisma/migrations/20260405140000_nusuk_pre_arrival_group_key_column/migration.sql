-- Column for normalized pre-arrival group (filled by script + app; unique index added in follow-up migration).
ALTER TABLE "nusuk_sheet_rows" ADD COLUMN IF NOT EXISTS "pre_arrival_group_key" TEXT;
