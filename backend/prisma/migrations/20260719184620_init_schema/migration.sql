-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "api_credentials_provider_check" CHECK ("provider" IN ('deepgram', 'openai'))
);

-- CreateTable
CREATE TABLE "agent_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT,
    "system_prompt" TEXT NOT NULL,
    "llm_model" TEXT NOT NULL,
    "voice_preference" TEXT,
    "job_description" TEXT,
    "candidate_resume" TEXT,
    "interview_preferences" JSONB,
    "interview_duration_minutes" INTEGER,
    "uploaded_questions" JSONB,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_configs_llm_model_check" CHECK ("llm_model" IN ('gpt-4o', 'gpt-4o-mini'))
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_config_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,
    "summary" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sessions_status_check" CHECK ("status" IN ('active', 'completed', 'aborted'))
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_role_check" CHECK ("role" IN ('user', 'assistant', 'system_event'))
);

-- CreateTable
CREATE TABLE "session_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "session_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "session_events_event_type_check" CHECK ("event_type" IN ('silence_prompt', 'interruption', 'utterance_end'))
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_credentials_user_id_provider_key" ON "api_credentials"("user_id", "provider");

-- AddForeignKey
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_agent_config_id_fkey" FOREIGN KEY ("agent_config_id") REFERENCES "agent_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
