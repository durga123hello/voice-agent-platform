import { z } from 'zod';

const AgentStatusEnum = z.enum(['active', 'restricted', 'inactive', 'review']);

// STT Configuration Schema
export const sttConfigSchema = z
  .object({
    available_models: z
      .array(z.string().min(1, 'Model name cannot be empty'))
      .min(1, 'At least one model must be provided'),
    avg_latency_ms: z
      .number()
      .positive('Average latency must be a positive number'),
    supported_languages: z
      .array(z.string().min(1, 'Language code cannot be empty'))
      .min(1, 'At least one supported language must be provided'),
    api_key_ref: z.string().optional(),
  })
  .strict();

export const createSttAgentSchema = z
  .object({
    name: z.string().min(1, 'Agent name is required'),
    provider_vendor: z.string().min(1, 'Provider vendor is required'),
    status: AgentStatusEnum.default('active'),
    config: sttConfigSchema,
  })
  .strict();

export const updateSttAgentSchema = z
  .object({
    name: z.string().min(1, 'Agent name cannot be empty').optional(),
    provider_vendor: z.string().min(1, 'Provider vendor cannot be empty').optional(),
    status: AgentStatusEnum.optional(),
    config: sttConfigSchema.partial().optional(),
  })
  .strict();

// TTS Configuration Schema
export const ttsConfigSchema = z
  .object({
    available_models: z
      .array(z.string().min(1, 'Model name cannot be empty'))
      .min(1, 'At least one model must be provided'),
    avg_latency_ms: z
      .number()
      .positive('Average latency must be a positive number'),
    available_voices: z
      .array(z.string().min(1, 'Voice name cannot be empty'))
      .min(1, 'At least one available voice must be provided'),
    sample_rate: z
      .number()
      .positive('Sample rate must be a positive number'),
    api_key_ref: z.string().optional(),
  })
  .strict();

export const createTtsAgentSchema = z
  .object({
    name: z.string().min(1, 'Agent name is required'),
    provider_vendor: z.string().min(1, 'Provider vendor is required'),
    status: AgentStatusEnum.default('active'),
    config: ttsConfigSchema,
  })
  .strict();

export const updateTtsAgentSchema = z
  .object({
    name: z.string().min(1, 'Agent name cannot be empty').optional(),
    provider_vendor: z.string().min(1, 'Provider vendor cannot be empty').optional(),
    status: AgentStatusEnum.optional(),
    config: ttsConfigSchema.partial().optional(),
  })
  .strict();

// LLM Configuration Schema
export const llmConfigSchema = z
  .object({
    available_models: z
      .array(z.string().min(1, 'Model name cannot be empty'))
      .min(1, 'At least one model must be provided'),
    context_window: z
      .number()
      .positive('Context window must be a positive number')
      .optional(),
    max_tokens: z
      .number()
      .positive('Max tokens must be a positive number')
      .optional(),
    supports_streaming: z.boolean(),
    api_key_ref: z.string().optional(),
  })
  .strict();

export const createLlmAgentSchema = z
  .object({
    name: z.string().min(1, 'Agent name is required'),
    provider_vendor: z.string().min(1, 'Provider vendor is required'),
    status: AgentStatusEnum.default('active'),
    config: llmConfigSchema,
  })
  .strict();

export const updateLlmAgentSchema = z
  .object({
    name: z.string().min(1, 'Agent name cannot be empty').optional(),
    provider_vendor: z.string().min(1, 'Provider vendor cannot be empty').optional(),
    status: AgentStatusEnum.optional(),
    config: llmConfigSchema.partial().optional(),
  })
  .strict();

// Telephony Configuration Schema
export const telephonyConfigSchema = z
  .object({
    available_models: z
      .array(z.string().min(1, 'Model/Number cannot be empty'))
      .optional(),
    auth_id: z.string().optional(),
    auth_token: z.string().optional(),
    auth_token_ref: z.string().optional(),
    from_number: z.string().optional(),
    answer_url_base: z.string().optional(),
    recording_enabled: z.boolean().optional(),
    api_key_ref: z.string().optional(),
  })
  .passthrough();

export const createTelephonyAgentSchema = z
  .object({
    name: z.string().min(1, 'Agent name is required'),
    provider_vendor: z.string().min(1, 'Provider vendor is required'),
    status: AgentStatusEnum.default('active'),
    config: telephonyConfigSchema.optional().default({}),
  })
  .passthrough();

export const updateTelephonyAgentSchema = z
  .object({
    name: z.string().min(1, 'Agent name cannot be empty').optional(),
    provider_vendor: z.string().min(1, 'Provider vendor cannot be empty').optional(),
    status: AgentStatusEnum.optional(),
    config: telephonyConfigSchema.partial().optional(),
  })
  .passthrough();
