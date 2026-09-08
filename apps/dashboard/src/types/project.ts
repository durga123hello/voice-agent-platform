export type ProjectStatus = "Active" | "In Development" | "Paused" | "Archived";

export interface Project {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  stt: string;
  tts: string;
  llmModel: string;
  aiAgent?: string;
  createdAt: string;
  environment?: string;
}

export interface ProjectFilters {
  search: string;
  status: string;
  stt: string;
}

export const STT_PROVIDERS = [
  "Deepgram Nova-2",
  "Deepgram Nova-2 (Medical)",
  "Whisper Large v3",
  "Azure Speech Services",
  "Google Cloud STT",
  "AssemblyAI Conformer-2"
] as const;

export const TTS_PROVIDERS = [
  "Cartesia Sonic (Fastest)",
  "ElevenLabs Turbo v2.5",
  "ElevenLabs Multilingual",
  "OpenAI Alloy",
  "Amazon Polly Neural",
  "Play.ht 2.0 Turbo"
] as const;

export const POPULAR_LLM_MODELS = [
  "GPT-4o",
  "GPT-4o Mini",
  "Claude 3.5 Sonnet",
  "Claude 3.5 Haiku",
  "Llama 3.3 70B",
  "Gemini 1.5 Pro",
  "Gemini 1.5 Flash",
  "DeepSeek-V3",
  "Mistral Large"
] as const;

export const LLM_PROVIDERS = POPULAR_LLM_MODELS;

export function resolveLlmModel(project: Partial<Project>): string {
  const raw = (project.llmModel || "").trim();
  const legacyAgent = (project.aiAgent || "").trim();

  // Clean popular recognized models
  if (raw && !raw.toLowerCase().includes("agent") && !raw.toLowerCase().includes("bot") && !raw.toLowerCase().includes("assistant") && !raw.toLowerCase().includes("concierge") && !raw.toLowerCase().includes("receptionist")) {
    const l = raw.toLowerCase();
    if (l === "gpt-4o") return "GPT-4o";
    if (l === "gpt-4o-mini" || l === "gpt-4o mini") return "GPT-4o Mini";
    if (l.includes("claude-3-5-sonnet") || l.includes("claude 3.5 sonnet")) return "Claude 3.5 Sonnet";
    if (l.includes("claude-3-haiku") || l.includes("claude 3.5 haiku")) return "Claude 3.5 Haiku";
    if (l.includes("llama-3.3-70b") || l.includes("llama 3.3 70b")) return "Llama 3.3 70B";
    if (l.includes("gemini-1.5-pro") || l.includes("gemini 1.5 pro")) return "Gemini 1.5 Pro";
    if (l.includes("gemini-1.5-flash") || l.includes("gemini 1.5 flash")) return "Gemini 1.5 Flash";
    if (l.includes("deepseek")) return "DeepSeek-V3";
    if (l.includes("mistral")) return "Mistral Large";
    return raw;
  }

  // Map legacy mock agents to popular LLMs
  const check = (raw || legacyAgent).toLowerCase();
  if (check.includes("triage") || check.includes("clinical")) return "GPT-4o";
  if (check.includes("support") || check.includes("concierge")) return "Claude 3.5 Sonnet";
  if (check.includes("dispatch") || check.includes("telephony")) return "Llama 3.3 70B";
  if (check.includes("wealth") || check.includes("advisor")) return "GPT-4o Mini";
  if (check.includes("bilingual") || check.includes("helpdesk")) return "Gemini 1.5 Pro";

  // Fallback by project ID
  if (project.projectId === "PRJ-401") return "GPT-4o";
  if (project.projectId === "PRJ-402") return "Claude 3.5 Sonnet";
  if (project.projectId === "PRJ-403") return "Llama 3.3 70B";
  if (project.projectId === "PRJ-404") return "GPT-4o Mini";
  if (project.projectId === "PRJ-405") return "Gemini 1.5 Pro";

  return "GPT-4o";
}
