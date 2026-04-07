-- CreateTable
CREATE TABLE "nusuk_sheet_rows" (
    "id" UUID NOT NULL,
    "sheet_row_number" INTEGER NOT NULL,
    "entity_name" TEXT NOT NULL,
    "pilgrims_count" INTEGER,
    "row_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nusuk_sheet_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nusuk_sheet_rows_entity_name_idx" ON "nusuk_sheet_rows"("entity_name");
