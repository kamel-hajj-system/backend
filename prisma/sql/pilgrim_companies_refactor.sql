-- Pilgrim companies refactor
-- 1) create new company-centric allocation model
-- 2) remove old service_center_nationalities model and legacy nationality totals

CREATE TABLE IF NOT EXISTS "pilgrim_companies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "external_code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "name_ar" TEXT,
  "expected_pilgrims_count" INTEGER NOT NULL DEFAULT 0,
  "merged_actual_pilgrims_count" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "pilgrim_company_nationalities" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "pilgrim_company_id" UUID NOT NULL REFERENCES "pilgrim_companies"("id") ON DELETE CASCADE,
  "pilgrim_nationality_id" UUID NOT NULL REFERENCES "pilgrim_nationalities"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("pilgrim_company_id", "pilgrim_nationality_id")
);

CREATE INDEX IF NOT EXISTS "pilgrim_company_nationalities_pilgrim_nationality_id_idx"
  ON "pilgrim_company_nationalities"("pilgrim_nationality_id");

CREATE TABLE IF NOT EXISTS "service_center_pilgrim_companies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_center_id" UUID NOT NULL REFERENCES "service_centers"("id") ON DELETE CASCADE,
  "pilgrim_company_id" UUID NOT NULL REFERENCES "pilgrim_companies"("id") ON DELETE CASCADE,
  "allocated_pilgrims" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  UNIQUE ("service_center_id", "pilgrim_company_id")
);

CREATE INDEX IF NOT EXISTS "service_center_pilgrim_companies_service_center_id_idx"
  ON "service_center_pilgrim_companies"("service_center_id");

CREATE INDEX IF NOT EXISTS "service_center_pilgrim_companies_pilgrim_company_id_idx"
  ON "service_center_pilgrim_companies"("pilgrim_company_id");

DROP TABLE IF EXISTS "service_center_nationalities";

ALTER TABLE "pilgrim_nationalities"
  DROP COLUMN IF EXISTS "total_pilgrims_count",
  DROP COLUMN IF EXISTS "total_arriving_pilgrims_count";
