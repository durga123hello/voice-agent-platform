export type IntegrationCategory = "STT Agent" | "TTS Agent" | "LLM Provider";
export type IntegrationStatus = "Active" | "Connected" | "Ready" | "Inactive";

export interface Integration {
  id: string;
  integrationId: string;
  name: string;
  category: IntegrationCategory;
  provider: string;
  availableModels: string;
  status: IntegrationStatus;
  apiKey: string;
  latency?: string;
  systemPrompt?: string;
  createdAt: string;
}

export interface IntegrationFilters {
  search: string;
  category: string;
  provider: string;
  status: string;
}
