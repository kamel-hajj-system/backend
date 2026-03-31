-- Baseline: full schema from prisma/schema.prisma at adopt-migrate time.
-- Existing databases that already match this schema should run once:
--   npx prisma migrate resolve --applied 20250331120000_baseline

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('Company', 'ServiceCenter', 'SuperAdmin');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Supervisor', 'EmpRead', 'EmpManage');

-- CreateEnum
CREATE TYPE "NotificationScheduleKind" AS ENUM ('ONCE', 'DAILY_RANGE');

-- CreateTable
CREATE TABLE "shift_locations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location_ar" TEXT,
    "zone_center_lat" DOUBLE PRECISION,
    "zone_center_lng" DOUBLE PRECISION,
    "zone_radius_meters" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "shift_ar" TEXT,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "is_for_employee" BOOLEAN NOT NULL DEFAULT true,
    "location_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_centers" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "name_ar" TEXT,
    "president_name" TEXT,
    "vice_president_name" TEXT,
    "max_capacity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pilgrim_companies" (
    "id" UUID NOT NULL,
    "external_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "expected_pilgrims_count" INTEGER NOT NULL,
    "merged_actual_pilgrims_count" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pilgrim_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pilgrim_company_nationalities" (
    "id" UUID NOT NULL,
    "pilgrim_company_id" UUID NOT NULL,
    "pilgrim_nationality_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pilgrim_company_nationalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_center_pilgrim_companies" (
    "id" UUID NOT NULL,
    "service_center_id" UUID NOT NULL,
    "pilgrim_company_id" UUID NOT NULL,
    "allocated_pilgrims" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_center_pilgrim_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pilgrim_nationalities" (
    "id" UUID NOT NULL,
    "code" TEXT,
    "flag_code" VARCHAR(32),
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pilgrim_nationalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "full_name_ar" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" TEXT,
    "user_type" "UserType" NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EmpRead',
    "job_title" TEXT,
    "shift_id" UUID,
    "location_id" UUID,
    "supervisor_id" UUID,
    "service_center_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_hr" BOOLEAN NOT NULL DEFAULT false,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" UUID,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entity_id" TEXT,
    "ip" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_grants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegated_employee_visibility" (
    "id" UUID NOT NULL,
    "viewer_id" UUID NOT NULL,
    "visible_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegated_employee_visibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "shift_start_at" TIMESTAMP(3) NOT NULL,
    "shift_end_at" TIMESTAMP(3) NOT NULL,
    "check_in_at" TIMESTAMP(3),
    "check_out_at" TIMESTAMP(3),
    "check_in_lat" DOUBLE PRECISION,
    "check_in_lng" DOUBLE PRECISION,
    "check_in_accuracy_meters" DOUBLE PRECISION,
    "check_in_inside_zone" BOOLEAN,
    "check_out_lat" DOUBLE PRECISION,
    "check_out_lng" DOUBLE PRECISION,
    "check_out_accuracy_meters" DOUBLE PRECISION,
    "check_out_inside_zone" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipients" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_notifications" (
    "id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "recipient_ids" JSONB NOT NULL,
    "schedule_kind" "NotificationScheduleKind" NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "range_start_date" DATE,
    "range_end_date" DATE,
    "daily_time_local" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "last_fired_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shifts_location_id_idx" ON "shifts"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_centers_code_key" ON "service_centers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "pilgrim_companies_external_code_key" ON "pilgrim_companies"("external_code");

-- CreateIndex
CREATE INDEX "pilgrim_company_nationalities_pilgrim_nationality_id_idx" ON "pilgrim_company_nationalities"("pilgrim_nationality_id");

-- CreateIndex
CREATE UNIQUE INDEX "pilgrim_company_nationalities_pilgrim_company_id_pilgrim_na_key" ON "pilgrim_company_nationalities"("pilgrim_company_id", "pilgrim_nationality_id");

-- CreateIndex
CREATE INDEX "service_center_pilgrim_companies_service_center_id_idx" ON "service_center_pilgrim_companies"("service_center_id");

-- CreateIndex
CREATE INDEX "service_center_pilgrim_companies_pilgrim_company_id_idx" ON "service_center_pilgrim_companies"("pilgrim_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_center_pilgrim_companies_service_center_id_pilgrim__key" ON "service_center_pilgrim_companies"("service_center_id", "pilgrim_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "pilgrim_nationalities_code_key" ON "pilgrim_nationalities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_is_deleted_is_active_idx" ON "users"("is_deleted", "is_active");

-- CreateIndex
CREATE INDEX "users_supervisor_id_idx" ON "users"("supervisor_id");

-- CreateIndex
CREATE INDEX "users_service_center_id_idx" ON "users"("service_center_id");

-- CreateIndex
CREATE INDEX "users_shift_id_idx" ON "users"("shift_id");

-- CreateIndex
CREATE INDEX "users_location_id_idx" ON "users"("location_id");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_expires_at_idx" ON "refresh_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "refresh_sessions_token_hash_idx" ON "refresh_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "access_grants_code_idx" ON "access_grants"("code");

-- CreateIndex
CREATE UNIQUE INDEX "access_grants_user_id_code_key" ON "access_grants"("user_id", "code");

-- CreateIndex
CREATE INDEX "delegated_employee_visibility_viewer_id_idx" ON "delegated_employee_visibility"("viewer_id");

-- CreateIndex
CREATE INDEX "delegated_employee_visibility_visible_user_id_idx" ON "delegated_employee_visibility"("visible_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "delegated_employee_visibility_viewer_id_visible_user_id_key" ON "delegated_employee_visibility"("viewer_id", "visible_user_id");

-- CreateIndex
CREATE INDEX "attendance_records_user_id_check_in_at_check_out_at_idx" ON "attendance_records"("user_id", "check_in_at", "check_out_at");

-- CreateIndex
CREATE INDEX "attendance_records_shift_id_shift_start_at_idx" ON "attendance_records"("shift_id", "shift_start_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_user_id_shift_start_at_key" ON "attendance_records"("user_id", "shift_start_at");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notification_recipients_user_id_is_read_created_at_idx" ON "notification_recipients"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipients_notification_id_user_id_key" ON "notification_recipients"("notification_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "scheduled_notifications_status_schedule_kind_idx" ON "scheduled_notifications"("status", "schedule_kind");

-- CreateIndex
CREATE INDEX "scheduled_notifications_created_by_id_status_idx" ON "scheduled_notifications"("created_by_id", "status");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "shift_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilgrim_company_nationalities" ADD CONSTRAINT "pilgrim_company_nationalities_pilgrim_company_id_fkey" FOREIGN KEY ("pilgrim_company_id") REFERENCES "pilgrim_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilgrim_company_nationalities" ADD CONSTRAINT "pilgrim_company_nationalities_pilgrim_nationality_id_fkey" FOREIGN KEY ("pilgrim_nationality_id") REFERENCES "pilgrim_nationalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_center_pilgrim_companies" ADD CONSTRAINT "service_center_pilgrim_companies_service_center_id_fkey" FOREIGN KEY ("service_center_id") REFERENCES "service_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_center_pilgrim_companies" ADD CONSTRAINT "service_center_pilgrim_companies_pilgrim_company_id_fkey" FOREIGN KEY ("pilgrim_company_id") REFERENCES "pilgrim_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "shift_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_service_center_id_fkey" FOREIGN KEY ("service_center_id") REFERENCES "service_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegated_employee_visibility" ADD CONSTRAINT "delegated_employee_visibility_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegated_employee_visibility" ADD CONSTRAINT "delegated_employee_visibility_visible_user_id_fkey" FOREIGN KEY ("visible_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
