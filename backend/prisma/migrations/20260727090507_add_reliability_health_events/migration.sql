-- Drop the old constraint
ALTER TABLE "session_events" DROP CONSTRAINT IF EXISTS "session_events_event_type_check";

-- Create the new updated check constraint containing provider_error and abort
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_event_type_check" CHECK ("event_type" IN ('silence_prompt', 'interruption', 'utterance_end', 'turn_latency', 'token_usage', 'reconnect', 'provider_error', 'abort'));