-- CreateEnum
CREATE TYPE "BusMovementReportStatus" AS ENUM ('PENDING_SUPERVISOR', 'APPROVED_AIRPORT', 'COMPLETED_ADMIN');

-- CreateTable
CREATE TABLE "bus_movement_reports" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "company_name" VARCHAR(500) NOT NULL,
    "bus_number" VARCHAR(120) NOT NULL,
    "pilgrim_count_on_bus" INTEGER NOT NULL,
    "nationality" VARCHAR(200) NOT NULL,
    "move_from" TEXT NOT NULL,
    "move_to" TEXT NOT NULL,
    "move_time" VARCHAR(120) NOT NULL,
    "status" "BusMovementReportStatus" NOT NULL DEFAULT 'PENDING_SUPERVISOR',
    "airport_supervisor_user_id" UUID,
    "airport_supervisor_approved_at" TIMESTAMP(3),
    "hospitality_center" VARCHAR(500),
    "housing_name" VARCHAR(500),
    "passport_count" INTEGER,
    "driver_name" VARCHAR(200),
    "guide_name" VARCHAR(200),
    "guide_phone" VARCHAR(50),
    "admin_supervisor_user_id" UUID,
    "admin_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bus_movement_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bus_movement_reports_location_id_created_at_idx" ON "bus_movement_reports"("location_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "bus_movement_reports_location_id_status_idx" ON "bus_movement_reports"("location_id", "status");

-- CreateIndex
CREATE INDEX "bus_movement_reports_created_by_id_idx" ON "bus_movement_reports"("created_by_id");

-- AddForeignKey
ALTER TABLE "bus_movement_reports" ADD CONSTRAINT "bus_movement_reports_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "shift_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bus_movement_reports" ADD CONSTRAINT "bus_movement_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bus_movement_reports" ADD CONSTRAINT "bus_movement_reports_airport_supervisor_user_id_fkey" FOREIGN KEY ("airport_supervisor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bus_movement_reports" ADD CONSTRAINT "bus_movement_reports_admin_supervisor_user_id_fkey" FOREIGN KEY ("admin_supervisor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
