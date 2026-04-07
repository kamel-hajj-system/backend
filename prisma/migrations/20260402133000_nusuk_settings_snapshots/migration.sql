-- Super Admin: configurable sheet URL + sync snapshots for restore
CREATE TABLE "nusuk_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "sheet_csv_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nusuk_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "nusuk_settings" ("id", "updated_at") VALUES ('default', CURRENT_TIMESTAMP);

CREATE TABLE "nusuk_sync_snapshots" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL DEFAULT 'auto',
    "label" TEXT,
    "source_url" TEXT,
    "row_count" INTEGER NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "meta" JSONB,

    CONSTRAINT "nusuk_sync_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "nusuk_sync_snapshots_created_at_idx" ON "nusuk_sync_snapshots"("created_at" DESC);
