-- AlterTable tenants
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex on tenants(contact_email)
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_contact_email_key" ON "tenants"("contact_email");

-- CreateTable otp_codes
CREATE TABLE IF NOT EXISTS "otp_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey otp_codes -> tenants
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'otp_codes_tenant_id_fkey'
    ) THEN
        ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_tenant_id_fkey" 
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable api_keys
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "key_type" TEXT NOT NULL DEFAULT 'private';

-- AlterTable agent_config_versions
ALTER TABLE "agent_config_versions" ADD COLUMN IF NOT EXISTS "first_message" TEXT;
ALTER TABLE "agent_config_versions" ADD COLUMN IF NOT EXISTS "transcriber_config" JSONB;
ALTER TABLE "agent_config_versions" ADD COLUMN IF NOT EXISTS "recording_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "agent_config_versions" ADD COLUMN IF NOT EXISTS "silence_timeout_seconds" INTEGER;
ALTER TABLE "agent_config_versions" ADD COLUMN IF NOT EXISTS "analysis_plan" JSONB;
ALTER TABLE "agent_config_versions" ADD COLUMN IF NOT EXISTS "custom_context" JSONB;
