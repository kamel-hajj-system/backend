-- CreateTable
CREATE TABLE "daily_company_reports" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "report_date" DATE NOT NULL,
    "tasks_json" JSONB NOT NULL,
    "updates_today" TEXT NOT NULL,
    "ministry_instructions_received" BOOLEAN NOT NULL DEFAULT false,
    "ministry_instructions_text" TEXT,
    "senior_management_needs" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_company_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_company_reports_location_id_report_date_idx" ON "daily_company_reports"("location_id", "report_date" DESC);

-- CreateIndex
CREATE INDEX "daily_company_reports_created_by_id_idx" ON "daily_company_reports"("created_by_id");

-- Unique: one report per user per calendar day
CREATE UNIQUE INDEX "daily_company_reports_created_by_id_report_date_key" ON "daily_company_reports"("created_by_id", "report_date");

-- AddForeignKey
ALTER TABLE "daily_company_reports" ADD CONSTRAINT "daily_company_reports_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "shift_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_company_reports" ADD CONSTRAINT "daily_company_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
