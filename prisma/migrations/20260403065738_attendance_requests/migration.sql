-- CreateEnum
CREATE TYPE "AttendanceRequestKind" AS ENUM ('WORK_LOCATION', 'ABSENCE');

-- CreateEnum
CREATE TYPE "WorkLocationMode" AS ENUM ('ONLINE', 'HOME');

-- CreateEnum
CREATE TYPE "AttendanceRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "attendance_requests" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "kind" "AttendanceRequestKind" NOT NULL,
    "status" "AttendanceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "work_location_mode" "WorkLocationMode",
    "effective_from" DATE,
    "absence_start_date" DATE,
    "absence_end_date" DATE,
    "absence_reason" TEXT,
    "attachment_file_name" TEXT,
    "attachment_stored_name" TEXT,
    "employee_note" TEXT,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_requests_requester_id_created_at_idx" ON "attendance_requests"("requester_id", "created_at");

-- CreateIndex
CREATE INDEX "attendance_requests_status_created_at_idx" ON "attendance_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "attendance_requests" ADD CONSTRAINT "attendance_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_requests" ADD CONSTRAINT "attendance_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
