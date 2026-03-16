-- Add optional Arabic name to users (full_name_ar).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "full_name_ar" TEXT;
