import { Integration } from '../types/integration';

export const INITIAL_MOCK_INTEGRATIONS: Integration[] = [
  // ==========================================
  // 1. STT AGENTS (Speech-to-Text)
  // ==========================================
  {
    id: 'int-1',
    integrationId: 'INT-801',
    name: 'Deepgram Nova-3 & Nova-2 STT Engine',
    category: 'STT Agent',
    provider: 'Deepgram',
    availableModels: 'nova-3-general, nova-2-medical, nova-2-finance',
    status: 'Active',
    apiKey: 'dg-live-8910283491029481',
    latency: '90ms',
    createdAt: 'Mon, Jan 22, 2024'
  },
  {
    id: 'int-2',
    integrationId: 'INT-802',
    name: 'OpenAI Whisper & Realtime STT',
    category: 'STT Agent',
    provider: 'OpenAI (Whisper)',
    availableModels: 'whisper-large-v3, whisper-1, gpt-4o-realtime-stt',
    status: 'Active',
    apiKey: 'sk-live-vopx-99824f8d2b9104',
    latency: '140ms',
    createdAt: 'Wed, Feb 14, 2024'
  },
  {
    id: 'int-3',
    integrationId: 'INT-803',
    name: 'AssemblyAI Universal-2 & Conformer',
    category: 'STT Agent',
    provider: 'AssemblyAI',
    availableModels: 'universal-2, conformer-2, slam-telephony',
    status: 'Ready',
    apiKey: 'aai-live-339102948c5510',
    latency: '120ms',
    createdAt: 'Tue, May 07, 2024'
  },
  {
    id: 'int-4',
    integrationId: 'INT-804',
    name: 'Speechmatics Ursa Real-Time Engine',
    category: 'STT Agent',
    provider: 'Speechmatics',
    availableModels: 'ursa-en, ursa-multilingual, realtime-v2',
    status: 'Active',
    apiKey: 'sm-key-991028471029',
    latency: '100ms',
    createdAt: 'Fri, Jun 28, 2024'
  },
  {
    id: 'int-5',
    integrationId: 'INT-805',
    name: 'Gladia Solaria Real-Time STT',
    category: 'STT Agent',
    provider: 'Gladia',
    availableModels: 'solaria-v1, realtime-v2',
    status: 'Active',
    apiKey: 'gladia-live-771029',
    latency: '95ms',
    createdAt: 'Wed, Aug 14, 2024'
  },
  {
    id: 'int-6',
    integrationId: 'INT-806',
    name: 'Google Cloud Speech Core (Chirp-2)',
    category: 'STT Agent',
    provider: 'Google Cloud Speech-to-Text',
    availableModels: 'chirp-2, telephony-v2, medical-dictation',
    status: 'Ready',
    apiKey: 'AIzaSy-vopx-881290344b1192',
    latency: '125ms',
    createdAt: 'Fri, Mar 01, 2024'
  },
  {
    id: 'int-7',
    integrationId: 'INT-807',
    name: 'Microsoft Azure Neural STT',
    category: 'STT Agent',
    provider: 'Microsoft Azure Speech',
    availableModels: 'en-US-Neural, es-MX-Neural, fr-FR-Neural',
    status: 'Active',
    apiKey: 'az-key-10928471209e8471',
    latency: '130ms',
    createdAt: 'Mon, Apr 15, 2024'
  },
  {
    id: 'int-8',
    integrationId: 'INT-808',
    name: 'AWS Transcribe Live & Medical',
    category: 'STT Agent',
    provider: 'AWS Transcribe',
    availableModels: 'medical-transcribe, streaming-v2',
    status: 'Active',
    apiKey: 'AKIAVOPX-aws-transcribe',
    latency: '150ms',
    createdAt: 'Thu, Jun 12, 2024'
  },
  {
    id: 'int-9',
    integrationId: 'INT-809',
    name: 'Groq Whisper LPU Fast Transcribe',
    category: 'STT Agent',
    provider: 'Groq STT (Whisper LPU)',
    availableModels: 'whisper-large-v3-turbo-groq',
    status: 'Active',
    apiKey: 'gsk-stt-992019482109',
    latency: '45ms',
    createdAt: 'Tue, Oct 01, 2024'
  },
  {
    id: 'int-10',
    integrationId: 'INT-810',
    name: 'ElevenLabs Scribe Realtime STT',
    category: 'STT Agent',
    provider: 'ElevenLabs (Scribe)',
    availableModels: 'scribe-v1-realtime',
    status: 'Ready',
    apiKey: 'el-scribe-key-881920',
    latency: '110ms',
    createdAt: 'Sun, Nov 10, 2024'
  },
  {
    id: 'int-11',
    integrationId: 'INT-811',
    name: 'Sarvam AI Saarika Indic STT',
    category: 'STT Agent',
    provider: 'Sarvam AI (Indic STT)',
    availableModels: 'saarika-v1-hi, saarika-v1-ta, saarika-v1-te',
    status: 'Active',
    apiKey: 'sarvam-stt-key-1029',
    latency: '115ms',
    createdAt: 'Wed, Dec 04, 2024'
  },

  // ==========================================
  // 2. TTS AGENTS (Text-to-Speech)
  // ==========================================
  {
    id: 'int-12',
    integrationId: 'INT-812',
    name: 'ElevenLabs Turbo v2.5 & Multilingual',
    category: 'TTS Agent',
    provider: 'ElevenLabs',
    availableModels: 'eleven_turbo_v2_5, eleven_multilingual_v2',
    status: 'Active',
    apiKey: 'el-key-449102834b921109',
    latency: '120ms',
    createdAt: 'Mon, Jan 22, 2024'
  },
  {
    id: 'int-13',
    integrationId: 'INT-813',
    name: 'Cartesia Sonic Ultra-Fast Engine',
    category: 'TTS Agent',
    provider: 'Cartesia',
    availableModels: 'sonic-english, sonic-multilingual',
    status: 'Active',
    apiKey: 'cart-live-99201948210928',
    latency: '85ms',
    createdAt: 'Thu, Mar 28, 2024'
  },
  {
    id: 'int-14',
    integrationId: 'INT-814',
    name: 'OpenAI Audio Speech Synthesis',
    category: 'TTS Agent',
    provider: 'OpenAI Audio TTS',
    availableModels: 'tts-1, tts-1-hd, gpt-4o-audio-preview',
    status: 'Connected',
    apiKey: 'sk-live-vopx-99824f8d2b9104',
    latency: '150ms',
    createdAt: 'Wed, Apr 10, 2024'
  },
  {
    id: 'int-15',
    integrationId: 'INT-815',
    name: 'Deepgram Aura Low-Latency TTS',
    category: 'TTS Agent',
    provider: 'Deepgram Aura',
    availableModels: 'aura-helios-en, aura-asteria-en, aura-orpheus-en',
    status: 'Active',
    apiKey: 'dg-aura-key-9910293',
    latency: '90ms',
    createdAt: 'Mon, May 06, 2024'
  },
  {
    id: 'int-16',
    integrationId: 'INT-816',
    name: 'Play.ht 2.0 Turbo Realtime',
    category: 'TTS Agent',
    provider: 'Play.ht',
    availableModels: 'playht-2.0-turbo, playht-multilingual',
    status: 'Ready',
    apiKey: 'pht-live-55102938109284',
    latency: '110ms',
    createdAt: 'Mon, Jun 03, 2024'
  },
  {
    id: 'int-17',
    integrationId: 'INT-817',
    name: 'LMNT Speech Synthesis API',
    category: 'TTS Agent',
    provider: 'LMNT',
    availableModels: 'lmnt-blizzard, lmnt-aurora',
    status: 'Active',
    apiKey: 'lmnt-key-33910284',
    latency: '95ms',
    createdAt: 'Thu, Jul 18, 2024'
  },
  {
    id: 'int-18',
    integrationId: 'INT-818',
    name: 'Rime AI Ultra-Fast Voice',
    category: 'TTS Agent',
    provider: 'Rime AI',
    availableModels: 'rime-v1-mist, rime-v1-arc',
    status: 'Active',
    apiKey: 'rime-live-9920194',
    latency: '80ms',
    createdAt: 'Wed, Aug 07, 2024'
  },
  {
    id: 'int-19',
    integrationId: 'INT-819',
    name: 'Azure Neural Voice Stream',
    category: 'TTS Agent',
    provider: 'Microsoft Azure Neural Voice',
    availableModels: 'en-US-JennyNeural, en-US-GuyNeural',
    status: 'Active',
    apiKey: 'az-tts-key-881920',
    latency: '120ms',
    createdAt: 'Fri, Sep 13, 2024'
  },
  {
    id: 'int-20',
    integrationId: 'INT-820',
    name: 'Sarvam AI Bulbul Indic TTS',
    category: 'TTS Agent',
    provider: 'Sarvam AI (Indic TTS)',
    availableModels: 'bulbul-v1-hi, bulbul-v1-ta, bulbul-v1-bn',
    status: 'Active',
    apiKey: 'sarvam-tts-key-55102',
    latency: '105ms',
    createdAt: 'Mon, Oct 21, 2024'
  },

  // ==========================================
  // 3. LLM PROVIDERS (Language Models)
  // ==========================================
  {
    id: 'int-21',
    integrationId: 'INT-821',
    name: 'OpenAI GPT-4o & o3-mini Provider',
    category: 'LLM Provider',
    provider: 'OpenAI (GPT-4o / o1 / o3)',
    availableModels: 'gpt-4o, gpt-4o-mini, o1, o3-mini',
    status: 'Active',
    apiKey: 'sk-live-vopx-99824f8d2b9104',
    latency: '210ms',
    createdAt: 'Mon, Jan 15, 2024'
  },
  {
    id: 'int-22',
    integrationId: 'INT-822',
    name: 'Anthropic Claude 3.5 Sonnet & Haiku',
    category: 'LLM Provider',
    provider: 'Anthropic (Claude 3.5)',
    availableModels: 'claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022',
    status: 'Active',
    apiKey: 'sk-ant-live-449102834b921109',
    latency: '230ms',
    createdAt: 'Wed, Feb 21, 2024'
  },
  {
    id: 'int-23',
    integrationId: 'INT-823',
    name: 'Google Gemini 2.0 Flash & 1.5 Pro',
    category: 'LLM Provider',
    provider: 'Google Gemini',
    availableModels: 'gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash',
    status: 'Active',
    apiKey: 'AIzaSy-vopx-881290344b1192',
    latency: '180ms',
    createdAt: 'Mon, May 20, 2024'
  },
  {
    id: 'int-24',
    integrationId: 'INT-824',
    name: 'Groq LPU Inference (Llama 3.3 70B)',
    category: 'LLM Provider',
    provider: 'Groq (LPU Engine)',
    availableModels: 'llama-3.3-70b-versatile, llama-3.1-8b-instant, deepseek-r1-distill-llama-70b',
    status: 'Active',
    apiKey: 'gsk-live-10928471209e8471',
    latency: '110ms',
    createdAt: 'Fri, Apr 05, 2024'
  },
  {
    id: 'int-25',
    integrationId: 'INT-825',
    name: 'DeepSeek R1 & V3 Reasoning Engine',
    category: 'LLM Provider',
    provider: 'DeepSeek',
    availableModels: 'deepseek-reasoner, deepseek-chat',
    status: 'Ready',
    apiKey: 'sk-dpsk-339102948c551092',
    latency: '240ms',
    createdAt: 'Tue, Jul 09, 2024'
  },
  {
    id: 'int-26',
    integrationId: 'INT-826',
    name: 'Together AI Fast LLM Endpoint',
    category: 'LLM Provider',
    provider: 'Together AI',
    availableModels: 'Qwen/Qwen2.5-72B-Instruct-Turbo, meta-llama/Llama-3.3-70B-Instruct-Turbo',
    status: 'Active',
    apiKey: 'together-key-9910284',
    latency: '150ms',
    createdAt: 'Wed, Aug 28, 2024'
  },
  {
    id: 'int-27',
    integrationId: 'INT-827',
    name: 'Fireworks AI Speed Inference',
    category: 'LLM Provider',
    provider: 'Fireworks AI',
    availableModels: 'accounts/fireworks/models/deepseek-r1, accounts/fireworks/models/llama-v3p3-70b-instruct',
    status: 'Active',
    apiKey: 'fw-live-339102948',
    latency: '130ms',
    createdAt: 'Thu, Sep 26, 2024'
  },
  {
    id: 'int-28',
    integrationId: 'INT-828',
    name: 'Perplexity AI Sonar Reasoning',
    category: 'LLM Provider',
    provider: 'Perplexity AI',
    availableModels: 'sonar-reasoning, sonar-pro, sonar',
    status: 'Active',
    apiKey: 'pplx-key-881920348',
    latency: '260ms',
    createdAt: 'Mon, Oct 14, 2024'
  },
  {
    id: 'int-29',
    integrationId: 'INT-829',
    name: 'xAI Grok-2 Neural Provider',
    category: 'LLM Provider',
    provider: 'xAI (Grok)',
    availableModels: 'grok-2-1212, grok-2-vision-1212',
    status: 'Active',
    apiKey: 'xai-live-992019482',
    latency: '220ms',
    createdAt: 'Fri, Nov 08, 2024'
  },
  {
    id: 'int-30',
    integrationId: 'INT-830',
    name: 'Mistral Large 2 & Codestral',
    category: 'LLM Provider',
    provider: 'Mistral AI',
    availableModels: 'mistral-large-2411, codestral-2501, mistral-small-2409',
    status: 'Connected',
    apiKey: 'mst-live-8810293481029',
    latency: '200ms',
    createdAt: 'Thu, Aug 01, 2024'
  },
  {
    id: 'int-31',
    integrationId: 'INT-831',
    name: 'AWS Bedrock Enterprise Gateway',
    category: 'LLM Provider',
    provider: 'AWS Bedrock',
    availableModels: 'anthropic.claude-3-5-sonnet-20241022-v2:0, amazon.nova-pro-v1:0',
    status: 'Active',
    apiKey: 'AKIAVOPX-bedrock-gateway',
    latency: '210ms',
    createdAt: 'Tue, Dec 17, 2024'
  },

  // ==========================================
  // 4. MOBILE TELEPHONY (Plivo & Voice Trunks)
  // ==========================================
  {
    id: 'int-32',
    integrationId: 'INT-832',
    name: 'Plivo Primary Voice Gateway',
    category: 'Mobile Telephony',
    provider: 'Plivo',
    availableModels: '+1 800 555 0199, +1 800 555 0144, +91 80 3115 1150',
    status: 'Active',
    apiKey: 'MAZJE4OTDLZDATNWRMNI',
    latency: '3 Active Numbers',
    createdAt: 'Fri, Jan 10, 2025'
  },
  {
    id: 'int-33',
    integrationId: 'INT-833',
    name: 'Plivo Secondary Toll-Free Trunk',
    category: 'Mobile Telephony',
    provider: 'Plivo',
    availableModels: '+1 888 443 8900, +1 877 221 0092',
    status: 'Ready',
    apiKey: 'MAY2039481029384710',
    latency: '2 Active Numbers',
    createdAt: 'Sun, Feb 02, 2025'
  }
];
