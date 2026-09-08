import { Project } from '../types/project';

export const INITIAL_MOCK_PROJECTS: Project[] = [
  {
    id: 'prj-1',
    projectId: 'PRJ-401',
    name: 'Clinical Inbound Triage',
    description: 'Automated patient intake, priority scheduling, and emergency symptom categorization.',
    status: 'Active',
    stt: 'Deepgram Nova-2 (Medical)',
    tts: 'Cartesia Sonic (Fastest)',
    llmModel: 'GPT-4o',
    createdAt: 'Mon, Jan 22, 2024',
    environment: 'Production'
  },
  {
    id: 'prj-2',
    projectId: 'PRJ-402',
    name: 'Global Support Concierge',
    description: 'Tier-1 conversational customer care, refund processing, and real-time order tracking.',
    status: 'Active',
    stt: 'Deepgram Nova-2',
    tts: 'ElevenLabs Turbo v2.5',
    llmModel: 'Claude 3.5 Sonnet',
    createdAt: 'Wed, Feb 14, 2024',
    environment: 'Production'
  },
  {
    id: 'prj-3',
    projectId: 'PRJ-403',
    name: 'Telephony Outbound Dispatch',
    description: 'Delivery driver real-time notifications, route deviations, and flight rescheduling alerts.',
    status: 'In Development',
    stt: 'Whisper Large v3',
    tts: 'OpenAI Alloy',
    llmModel: 'Llama 3.3 70B',
    createdAt: 'Fri, Apr 05, 2024',
    environment: 'Staging'
  },
  {
    id: 'prj-4',
    projectId: 'PRJ-404',
    name: 'Executive Wealth Advisor',
    description: 'High-security biometric voice banking, portfolio analysis, and institutional wealth guidance.',
    status: 'Active',
    stt: 'Deepgram Nova-2',
    tts: 'Cartesia Sonic (Fastest)',
    llmModel: 'GPT-4o Mini',
    createdAt: 'Mon, May 20, 2024',
    environment: 'Production'
  },
  {
    id: 'prj-5',
    projectId: 'PRJ-405',
    name: 'Bilingual IT Helpdesk',
    description: 'Arabic & English internal workplace concierge, password reset automation, and hardware provisioning.',
    status: 'Paused',
    stt: 'Azure Speech Services',
    tts: 'ElevenLabs Multilingual',
    llmModel: 'Gemini 1.5 Pro',
    createdAt: 'Tue, Jul 09, 2024',
    environment: 'Staging'
  }
];
