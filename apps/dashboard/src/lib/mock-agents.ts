import { AIAgent } from '../types/agent';

export const INITIAL_MOCK_AGENTS: AIAgent[] = [
  {
    id: 'agt-1',
    agentId: 'AGT-701',
    name: 'Healthcare Triage Assistant',
    provider: 'OpenAI',
    availableModels: 'gpt-4o, gpt-4o-mini',
    status: 'Active',
    apiKey: 'sk-live-vopx-99824f8d2b9104',
    systemPrompt: 'You are a warm, clinical telephone triage assistant. Gather symptoms carefully and assign urgency level.',
    temperature: 0.2,
    createdAt: 'Mon, Jan 22, 2024'
  },
  {
    id: 'agt-2',
    agentId: 'AGT-702',
    name: 'Customer Support Bot',
    provider: 'Anthropic',
    availableModels: 'claude-3-5-sonnet, claude-3-haiku',
    status: 'Active',
    apiKey: 'sk-ant-live-449102834b9211',
    systemPrompt: 'You are an empathetic, rapid-response customer service concierge for tier-1 inquiries and escalations.',
    temperature: 0.3,
    createdAt: 'Wed, Feb 14, 2024'
  },
  {
    id: 'agt-3',
    agentId: 'AGT-703',
    name: 'Ultra-Fast Dispatch Voice Core',
    provider: 'Groq',
    availableModels: 'llama-3.3-70b-versatile, mixtral-8x7b',
    status: 'Active',
    apiKey: 'gsk-live-10928471209e84',
    systemPrompt: 'You are an ultra-low latency operational coordinator delivering immediate driver instructions under 200ms.',
    temperature: 0.1,
    createdAt: 'Fri, Apr 05, 2024'
  },
  {
    id: 'agt-4',
    agentId: 'AGT-704',
    name: 'Multimodal Research Assistant',
    provider: 'Google DeepMind',
    availableModels: 'gemini-1.5-pro, gemini-1.5-flash',
    status: 'Testing',
    apiKey: 'AIzaSy-vopx-881290344b1192',
    systemPrompt: 'You analyze complex queries, cross-reference historical telephony session logs, and report insights.',
    temperature: 0.4,
    createdAt: 'Mon, May 20, 2024'
  },
  {
    id: 'agt-5',
    agentId: 'AGT-705',
    name: 'Bilingual IT Helpdesk Agent',
    provider: 'DeepSeek',
    availableModels: 'deepseek-chat, deepseek-coder',
    status: 'Training',
    apiKey: 'sk-dpsk-339102948c5510',
    systemPrompt: 'You diagnose software tickets, execute active directory password resets, and route enterprise IT requests.',
    temperature: 0.2,
    createdAt: 'Tue, Jul 09, 2024'
  }
];
