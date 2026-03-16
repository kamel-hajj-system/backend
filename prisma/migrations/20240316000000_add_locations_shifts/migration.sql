-- CreateTable locations
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable shifts
CREATE TABLE "shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "is_for_employee" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- AlterTable users: add shift_id, then drop shift
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "shift_id" UUID;

-- Drop old shift column (may need to allow null first if existing data)
ALTER TABLE "users" ALTER COLUMN "shift" DROP NOT NULL;
ALTER TABLE "users" DROP COLUMN IF EXISTS "shift";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_shift_id_idx" ON "users"("shift_id");
CREATE INDEX IF NOT EXISTS "users_location_id_idx" ON "users"("location_id");

-- Clear orphan location_id so FK can be added (locations table is new/empty)
UPDATE "users" SET "location_id" = NULL WHERE "location_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "locations" l WHERE l."id" = "users"."location_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
