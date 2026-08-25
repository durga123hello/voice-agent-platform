-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "recording_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recording_url" TEXT;
