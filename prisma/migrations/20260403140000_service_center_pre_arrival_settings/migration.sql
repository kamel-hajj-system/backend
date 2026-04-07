CREATE TABLE "service_center_pre_arrival_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "config" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_center_pre_arrival_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "service_center_pre_arrival_settings" ("id", "config", "updated_at") VALUES ('default', '{}', CURRENT_TIMESTAMP);
