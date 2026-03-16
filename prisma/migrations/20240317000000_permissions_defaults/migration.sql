-- Add optional module to permissions (for documentation / grouping)
ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "module" TEXT;

-- CreateTable default_permissions (default permissions per user type)
CREATE TABLE "default_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_type" "UserType" NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "default_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "default_permissions_user_type_permission_id_key" ON "default_permissions"("user_type", "permission_id");
CREATE INDEX "default_permissions_user_type_idx" ON "default_permissions"("user_type");

ALTER TABLE "default_permissions" ADD CONSTRAINT "default_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
