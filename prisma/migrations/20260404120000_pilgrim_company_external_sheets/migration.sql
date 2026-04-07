-- Pilgrim Company public Google Sheet sources (URLs + labels; sheet rows are not stored).
CREATE TABLE "pilgrim_company_external_sheets" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sheet_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pilgrim_company_external_sheets_pkey" PRIMARY KEY ("id")
);
