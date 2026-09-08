export type AgentStatus = "Active" | "Training" | "Testing" | "Inactive";

export interface AIAgent {
  id: string;
  agentId: string;
  name: string;
  provider: string;
  availableModels: string;
  status: AgentStatus;
  apiKey: string;
  systemPrompt?: string;
  temperature?: number;
  createdAt: string;
}

export interface AgentFilters {
  search: string;
  provider: string;
  status: string;
}
