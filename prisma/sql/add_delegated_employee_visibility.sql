-- One-time: delegated employee visibility (Prisma model DelegatedEmployeeVisibility).
-- Prefer: npx prisma db push (from backend root) with production DATABASE_URL.
-- Use this file only if you must run SQL directly (e.g. managed DB console).

CREATE TABLE IF NOT EXISTS "delegated_employee_visibility" (
  "id" UUID NOT NULL,
  "viewer_id" UUID NOT NULL,
  "visible_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delegated_employee_visibility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "delegated_employee_visibility_viewer_id_visible_user_id_key"
  ON "delegated_employee_visibility" ("viewer_id", "visible_user_id");

CREATE INDEX IF NOT EXISTS "delegated_employee_visibility_viewer_id_idx"
  ON "delegated_employee_visibility" ("viewer_id");

CREATE INDEX IF NOT EXISTS "delegated_employee_visibility_visible_user_id_idx"
  ON "delegated_employee_visibility" ("visible_user_id");

DO $$ BEGIN
  ALTER TABLE "delegated_employee_visibility"
    ADD CONSTRAINT "delegated_employee_visibility_viewer_id_fkey"
    FOREIGN KEY ("viewer_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "delegated_employee_visibility"
    ADD CONSTRAINT "delegated_employee_visibility_visible_user_id_fkey"
    FOREIGN KEY ("visible_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
