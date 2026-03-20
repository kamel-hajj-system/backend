-- One-time: add scheduled notifications (Prisma model ScheduledNotification).
-- Prefer: npx prisma db push (from backend root) against production DATABASE_URL.
-- Use this file only if you must run SQL directly (e.g. managed DB console).

DO $$ BEGIN
  CREATE TYPE "NotificationScheduleKind" AS ENUM ('ONCE', 'DAILY_RANGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "scheduled_notifications" (
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
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scheduled_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "scheduled_notifications_status_schedule_kind_idx"
  ON "scheduled_notifications" ("status", "schedule_kind");

CREATE INDEX IF NOT EXISTS "scheduled_notifications_created_by_id_status_idx"
  ON "scheduled_notifications" ("created_by_id", "status");

DO $$ BEGIN
  ALTER TABLE "scheduled_notifications"
    ADD CONSTRAINT "scheduled_notifications_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
