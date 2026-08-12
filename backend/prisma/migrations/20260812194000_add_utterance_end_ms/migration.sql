-- AlterTable agent_config_versions
ALTER TABLE "agent_config_versions" ADD COLUMN IF NOT EXISTS "utterance_end_ms" INTEGER DEFAULT 1800;
