-- CreateTable
CREATE TABLE "nusuk_sheet_row_edit_locks" (
    "row_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lock_token" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nusuk_sheet_row_edit_locks_pkey" PRIMARY KEY ("row_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nusuk_sheet_row_edit_locks_lock_token_key" ON "nusuk_sheet_row_edit_locks"("lock_token");

-- CreateIndex
CREATE INDEX "nusuk_sheet_row_edit_locks_expires_at_idx" ON "nusuk_sheet_row_edit_locks"("expires_at");

-- AddForeignKey
ALTER TABLE "nusuk_sheet_row_edit_locks" ADD CONSTRAINT "nusuk_sheet_row_edit_locks_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "nusuk_sheet_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nusuk_sheet_row_edit_locks" ADD CONSTRAINT "nusuk_sheet_row_edit_locks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
