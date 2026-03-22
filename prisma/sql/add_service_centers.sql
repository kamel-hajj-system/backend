-- Service centers + pilgrim nationalities (see schema.prisma).
-- Prefer: `npx prisma db push` from backend.

CREATE TABLE IF NOT EXISTS service_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT,
  name_ar TEXT,
  president_name TEXT,
  vice_president_name TEXT,
  max_capacity INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_centers_code_key UNIQUE (code)
);

-- If upgrading an older DB that had service_centers without `code`:
--   ALTER TABLE service_centers ADD COLUMN IF NOT EXISTS code TEXT;
--   UPDATE service_centers SET code = SUBSTRING(REPLACE(id::text, '-', ''), 1, 12) WHERE code IS NULL OR code = '';
--   ALTER TABLE service_centers ALTER COLUMN code SET NOT NULL;
--   CREATE UNIQUE INDEX IF NOT EXISTS service_centers_code_key ON service_centers(code);

-- If upgrading: display names are derived from code by the app; backfill example:
-- ALTER TABLE service_centers ADD COLUMN IF NOT EXISTS name_ar TEXT;
-- UPDATE service_centers SET name = 'Service Center ' || code WHERE code IS NOT NULL AND (name IS NULL OR name = '');
-- UPDATE service_centers SET name_ar = 'مركز الخدمة ' || code WHERE code IS NOT NULL AND (name_ar IS NULL OR name_ar = '');

-- If upgrading: remove redundant center-level pilgrims count (use sum of service_center_nationalities.pilgrims_count).
-- ALTER TABLE service_centers DROP COLUMN IF EXISTS pilgrims_count;

CREATE TABLE IF NOT EXISTS pilgrim_nationalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  name_ar TEXT,
  notes TEXT,
  total_pilgrims_count INTEGER,
  total_arriving_pilgrims_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If table existed without totals:
-- ALTER TABLE pilgrim_nationalities ADD COLUMN IF NOT EXISTS total_pilgrims_count INTEGER;
-- ALTER TABLE pilgrim_nationalities ADD COLUMN IF NOT EXISTS total_arriving_pilgrims_count INTEGER;

CREATE TABLE IF NOT EXISTS service_center_nationalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
  pilgrim_nationality_id UUID NOT NULL REFERENCES pilgrim_nationalities(id) ON DELETE CASCADE,
  pilgrims_count INTEGER NOT NULL DEFAULT 0,
  arriving_pilgrims_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (service_center_id, pilgrim_nationality_id)
);

CREATE INDEX IF NOT EXISTS service_center_nationalities_service_center_id_idx ON service_center_nationalities(service_center_id);
CREATE INDEX IF NOT EXISTS service_center_nationalities_pilgrim_nationality_id_idx ON service_center_nationalities(pilgrim_nationality_id);
