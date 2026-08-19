/*
  Warnings:

  - Made the column `created_at` on table `otp_codes` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "otp_codes" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "call_state" TEXT NOT NULL DEFAULT 'INITIATING',
ADD COLUMN     "conversation_state" TEXT NOT NULL DEFAULT 'IDLE',
ADD COLUMN     "ended_reason" TEXT,
ADD COLUMN     "error_code" TEXT,
ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "media_state" TEXT NOT NULL DEFAULT 'DISCONNECTED',
ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "provider_call_id" TEXT,
ADD COLUMN     "transport" TEXT NOT NULL DEFAULT 'webrtc',
ADD COLUMN     "user_message" TEXT;
