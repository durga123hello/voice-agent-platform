-- 1. Create tenants table
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- 2. Create providers table
CREATE TABLE "providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- 3. Seed providers
INSERT INTO "providers" ("name", "type") VALUES ('deepgram', 'stt');
INSERT INTO "providers" ("name", "type") VALUES ('deepgram', 'tts');
INSERT INTO "providers" ("name", "type") VALUES ('openai', 'llm');

-- 4. Create default tenant
INSERT INTO "tenants" ("id", "name") VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant');

-- 5. Add tenant_id to users and default it to the default tenant
ALTER TABLE "users" ADD COLUMN "tenant_id" UUID;
UPDATE "users" SET "tenant_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Add tenant_id to agent_configs and default it to the default tenant
ALTER TABLE "agent_configs" ADD COLUMN "tenant_id" UUID;
UPDATE "agent_configs" SET "tenant_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "agent_configs" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Create agent_config_versions table
CREATE TABLE "agent_config_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_config_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "system_prompt" TEXT NOT NULL,
    "llm_model" TEXT NOT NULL,
    "voice_preference" TEXT,
    "job_description" TEXT,
    "candidate_resume" TEXT,
    "interview_preferences" JSONB,
    "interview_duration_minutes" INTEGER,
    "uploaded_questions" JSONB,
    "behavior_settings" JSONB,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_config_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_config_versions_agent_config_id_fkey" FOREIGN KEY ("agent_config_id") REFERENCES "agent_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 8. Backfill agent_config_versions from agent_configs
INSERT INTO "agent_config_versions" (
    "id",
    "agent_config_id",
    "version",
    "system_prompt",
    "llm_model",
    "voice_preference",
    "job_description",
    "candidate_resume",
    "interview_preferences",
    "interview_duration_minutes",
    "uploaded_questions",
    "created_at"
)
SELECT
    gen_random_uuid(),
    "id",
    1,
    "system_prompt",
    "llm_model",
    "voice_preference",
    "job_description",
    "candidate_resume",
    "interview_preferences",
    "interview_duration_minutes",
    "uploaded_questions",
    "created_at"
FROM "agent_configs";

-- 9. Add tenant_id and agent_config_version_id to sessions
ALTER TABLE "sessions" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "sessions" ADD COLUMN "agent_config_version_id" UUID;

-- 10. Update sessions to point to the default tenant
UPDATE "sessions" SET "tenant_id" = '00000000-0000-0000-0000-000000000001';

-- 11. Update sessions to point to the version 1 row in agent_config_versions for their agent_config_id
UPDATE "sessions" s
SET "agent_config_version_id" = v."id"
FROM "agent_config_versions" v
WHERE s."agent_config_id" = v."agent_config_id";

-- 12. Make columns NOT NULL and add foreign keys/constraints
ALTER TABLE "sessions" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "sessions" ALTER COLUMN "agent_config_version_id" SET NOT NULL;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_agent_config_version_id_fkey" FOREIGN KEY ("agent_config_version_id") REFERENCES "agent_config_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 13. Drop old column and constraint from sessions
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_agent_config_id_fkey";
ALTER TABLE "sessions" DROP COLUMN "agent_config_id";

-- 14. Drop versioned columns from agent_configs
ALTER TABLE "agent_configs" DROP COLUMN "system_prompt";
ALTER TABLE "agent_configs" DROP COLUMN "llm_model";
ALTER TABLE "agent_configs" DROP COLUMN "voice_preference";
ALTER TABLE "agent_configs" DROP COLUMN "job_description";
ALTER TABLE "agent_configs" DROP COLUMN "candidate_resume";
ALTER TABLE "agent_configs" DROP COLUMN "interview_preferences";
ALTER TABLE "agent_configs" DROP COLUMN "interview_duration_minutes";
ALTER TABLE "agent_configs" DROP COLUMN "uploaded_questions";
