-- AlterTable
ALTER TABLE "attendance_requests" ADD COLUMN "effective_to" DATE;

UPDATE "attendance_requests"
SET "effective_to" = "effective_from"
WHERE "kind" = 'WORK_LOCATION' AND "effective_from" IS NOT NULL AND "effective_to" IS NULL;
