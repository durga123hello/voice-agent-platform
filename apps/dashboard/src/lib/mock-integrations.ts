import { Integration } from '../types/integration';

export const INITIAL_MOCK_INTEGRATIONS: Integration[] = [
  // 1. STT AGENTS (Speech-to-Text)
  {
    id: 'int-1',
    integrationId: 'INT-801',
    name: 'Deepgram Nova-2 STT Agent',
    category: 'STT Agent',
    provider: 'Deepgram',
    availableModels: 'nova-2-general, nova-2-medical, nova-2-finance',
    status: 'Active',
    apiKey: 'dg-live-8910283491029481',
    latency: '110ms',
    createdAt: 'Mon, Jan 22, 2024'
  },
  {
    id: 'int-2',
    integrationId: 'INT-802',
    name: 'Whisper Large v3 STT Agent',
    category: 'STT Agent',
    provider: 'OpenAI / Whisper',
    availableModels: 'whisper-large-v3, whisper-1',
    status: 'Active',
    apiKey: 'sk-live-vopx-99824f8d2b9104',
    latency: '180ms',
    createdAt: 'Wed, Feb 14, 2024'
  },
  {
    id: 'int-3',
    integrationId: 'INT-803',
    name: 'Google Cloud Speech Core',
    category: 'STT Agent',
    provider: 'Google Cloud',
    availableModels: 'telephony-v2, medical-dictation, video-v1',
    status: 'Ready',
    apiKey: 'AIzaSy-vopx-881290344b1192',
    latency: '140ms',
    createdAt: 'Fri, Mar 01, 2024'
  },
  {
    id: 'int-4',
    integrationId: 'INT-804',
    name: 'Azure Speech Recognition',
    category: 'STT Agent',
    provider: 'Microsoft Azure',
    availableModels: 'en-US-Neural, es-MX-Neural, fr-FR-Neural',
    status: 'Active',
    apiKey: 'az-key-10928471209e8471',
    latency: '135ms',
    createdAt: 'Mon, Apr 15, 2024'
  },
  {
    id: 'int-5',
    integrationId: 'INT-805',
    name: 'AssemblyAI Conformer-2',
    category: 'STT Agent',
    provider: 'AssemblyAI',
    availableModels: 'conformer-2-realtime, pcm-16k',
    status: 'Ready',
    apiKey: 'aai-live-339102948c5510',
    latency: '160ms',
    createdAt: 'Tue, May 07, 2024'
  },

  // 2. TTS AGENTS (Text-to-Speech)
  {
    id: 'int-6',
    integrationId: 'INT-806',
    name: 'ElevenLabs Turbo v2.5 TTS',
    category: 'TTS Agent',
    provider: 'ElevenLabs',
    availableModels: 'eleven_turbo_v2_5, eleven_multilingual_v2',
    status: 'Active',
    apiKey: 'el-key-449102834b921109',
    latency: '130ms',
    createdAt: 'Mon, Jan 22, 2024'
  },
  {
    id: 'int-7',
    integrationId: 'INT-807',
    name: 'Cartesia Sonic Ultra-Fast TTS',
    category: 'TTS Agent',
    provider: 'Cartesia',
    availableModels: 'sonic-english, sonic-multilingual',
    status: 'Active',
    apiKey: 'cart-live-99201948210928',
    latency: '90ms',
    createdAt: 'Thu, Mar 28, 2024'
  },
  {
    id: 'int-8',
    integrationId: 'INT-808',
    name: 'OpenAI Speech Synthesis',
    category: 'TTS Agent',
    provider: 'OpenAI',
    availableModels: 'tts-1, tts-1-hd (alloy, echo, fable, onyx, nova)',
    status: 'Connected',
    apiKey: 'sk-live-vopx-99824f8d2b9104',
    latency: '210ms',
    createdAt: 'Wed, Apr 10, 2024'
  },
  {
    id: 'int-9',
    integrationId: 'INT-809',
    name: 'Amazon Polly Neural Voice',
    category: 'TTS Agent',
    provider: 'Amazon Web Services',
    availableModels: 'polly-neural-v2, joanna, matthew, amy',
    status: 'Active',
    apiKey: 'AKIAVOPX771092841029',
    latency: '175ms',
    createdAt: 'Sun, May 19, 2024'
  },
  {
    id: 'int-10',
    integrationId: 'INT-810',
    name: 'Play.ht 2.0 Turbo Speech',
    category: 'TTS Agent',
    provider: 'Play.ht',
    availableModels: 'playht-2.0-turbo, playht-multilingual',
    status: 'Ready',
    apiKey: 'pht-live-55102938109284',
    latency: '150ms',
    createdAt: 'Mon, Jun 03, 2024'
  },

  // 3. LLM PROVIDERS (Language Models)
  {
    id: 'int-11',
    integrationId: 'INT-811',
    name: 'OpenAI GPT-4o LLM Provider',
    category: 'LLM Provider',
    provider: 'OpenAI',
    availableModels: 'gpt-4o, gpt-4o-mini, o1-preview',
    status: 'Active',
    apiKey: 'sk-live-vopx-99824f8d2b9104',
    latency: '220ms',
    createdAt: 'Mon, Jan 15, 2024'
  },
  {
    id: 'int-12',
    integrationId: 'INT-812',
    name: 'Anthropic Claude 3.5 Sonnet',
    category: 'LLM Provider',
    provider: 'Anthropic',
    availableModels: 'claude-3-5-sonnet, claude-3-5-haiku',
    status: 'Active',
    apiKey: 'sk-ant-live-449102834b921109',
    latency: '240ms',
    createdAt: 'Wed, Feb 21, 2024'
  },
  {
    id: 'int-13',
    integrationId: 'INT-813',
    name: 'Meta Llama 3.3 70B Engine',
    category: 'LLM Provider',
    provider: 'Meta AI / Groq',
    availableModels: 'llama-3.3-70b-instruct, llama-3.1-405b',
    status: 'Active',
    apiKey: 'gsk-live-10928471209e8471',
    latency: '160ms',
    createdAt: 'Fri, Apr 05, 2024'
  },
  {
    id: 'int-14',
    integrationId: 'INT-814',
    name: 'Google Gemini 1.5 Pro Provider',
    category: 'LLM Provider',
    provider: 'Google DeepMind',
    availableModels: 'gemini-1.5-pro, gemini-1.5-flash',
    status: 'Active',
    apiKey: 'AIzaSy-vopx-881290344b1192',
    latency: '190ms',
    createdAt: 'Mon, May 20, 2024'
  },
  {
    id: 'int-15',
    integrationId: 'INT-815',
    name: 'DeepSeek-V3 Reasoning Engine',
    category: 'LLM Provider',
    provider: 'DeepSeek',
    availableModels: 'deepseek-v3, deepseek-r1',
    status: 'Ready',
    apiKey: 'sk-dpsk-339102948c551092',
    latency: '250ms',
    createdAt: 'Tue, Jul 09, 2024'
  },
  {
    id: 'int-16',
    integrationId: 'INT-816',
    name: 'Mistral Large 2 Provider',
    category: 'LLM Provider',
    provider: 'Mistral AI',
    availableModels: 'mistral-large-2411, mistral-small',
    status: 'Connected',
    apiKey: 'mst-live-8810293481029',
    latency: '210ms',
    createdAt: 'Thu, Aug 01, 2024'
  }
];
