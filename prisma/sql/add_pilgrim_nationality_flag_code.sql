-- Optional manual migration: add flag_code for portal flag images (code stays free-form).
ALTER TABLE pilgrim_nationalities
  ADD COLUMN IF NOT EXISTS flag_code VARCHAR(32) NULL;

COMMENT ON COLUMN pilgrim_nationalities.flag_code IS 'ISO 3166-1 alpha-2 or alpha-3 for UI flags; code column is free-form.';
