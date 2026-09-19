import { Integration, IntegrationCategory, IntegrationStatus } from '../types/integration';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function getAuthHeaders(token?: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function mapBackendToIntegration(agent: any): Integration {
  let category: IntegrationCategory = 'STT Agent';
  if (agent.type === 'tts') category = 'TTS Agent';
  else if (agent.type === 'llm') category = 'LLM Provider';
  else if (agent.type === 'telephony') category = 'Mobile Telephony';

  let status: IntegrationStatus = 'Active';
  if (agent.status === 'inactive') status = 'Inactive';
  else if (agent.status === 'review' || agent.status === 'restricted') status = 'Ready';

  const config = agent.config || {};
  const models = Array.isArray(config.available_models)
    ? config.available_models.join(', ')
    : typeof config.available_models === 'string'
    ? config.available_models
    : '';

  const latencyStr = config.avg_latency_ms ? `${config.avg_latency_ms}ms` : undefined;

  let createdStr = '';
  if (agent.created_at || agent.createdAt) {
    try {
      createdStr = new Date(agent.created_at || agent.createdAt).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      });
    } catch (e) {
      createdStr = agent.created_at || agent.createdAt;
    }
  }

  return {
    id: agent.id,
    integrationId: agent.id ? `INT-${agent.id.slice(0, 4).toUpperCase()}` : 'INT-000',
    name: agent.name,
    category,
    provider: agent.provider_vendor || agent.providerVendor || '',
    availableModels: models,
    status,
    apiKey: config.api_key_ref || '••••••••',
    latency: latencyStr,
    createdAt: createdStr,
  };
}

async function ensureValidToken(currentToken: string | null): Promise<string> {
  if (currentToken && currentToken.length > 20) {
    return currentToken;
  }

  try {
    const savedSession = typeof window !== 'undefined' ? localStorage.getItem('vopx_auth_session') : null;
    let email = 'user@vopx.ai';
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.email) email = parsed.email;
      } catch (e) {}
    }

    const res = await fetch(`${API_BASE}/api/auth/dashboard-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      const data = await res.json();
      const freshToken = data.token;
      if (freshToken) {
        if (typeof window !== 'undefined' && savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            parsed.token = freshToken;
            localStorage.setItem('vopx_auth_session', JSON.stringify(parsed));
          } catch (e) {}
        }
        return freshToken;
      }
    }
  } catch (e) {
    console.error('Failed acquiring fresh dashboard JWT session token:', e);
  }

  return currentToken || '';
}

export async function fetchAllIntegrations(token: string | null): Promise<Integration[]> {
  const authToken = await ensureValidToken(token);
  const headers = getAuthHeaders(authToken);

  const [sttRes, ttsRes, llmRes, telephonyRes] = await Promise.allSettled([
    fetch(`${API_BASE}/api/stt-agents`, { headers }),
    fetch(`${API_BASE}/api/tts-agents`, { headers }),
    fetch(`${API_BASE}/api/llm-agents`, { headers }),
    fetch(`${API_BASE}/api/telephony-agents`, { headers }),
  ]);

  const results: Integration[] = [];

  if (sttRes.status === 'fulfilled' && sttRes.value.ok) {
    const data = await sttRes.value.json();
    if (Array.isArray(data)) {
      results.push(...data.map(mapBackendToIntegration));
    }
  }

  if (ttsRes.status === 'fulfilled' && ttsRes.value.ok) {
    const data = await ttsRes.value.json();
    if (Array.isArray(data)) {
      results.push(...data.map(mapBackendToIntegration));
    }
  }

  if (llmRes.status === 'fulfilled' && llmRes.value.ok) {
    const data = await llmRes.value.json();
    if (Array.isArray(data)) {
      results.push(...data.map(mapBackendToIntegration));
    }
  }

  if (telephonyRes.status === 'fulfilled' && telephonyRes.value.ok) {
    const data = await telephonyRes.value.json();
    if (Array.isArray(data)) {
      results.push(...data.map(mapBackendToIntegration));
    }
  }

  return results;
}

export async function fetchIntegrationsByCategory(
  category: IntegrationCategory,
  token: string | null
): Promise<Integration[]> {
  const authToken = await ensureValidToken(token);
  const headers = getAuthHeaders(authToken);

  let endpoint = '/api/stt-agents';
  if (category === 'TTS Agent') endpoint = '/api/tts-agents';
  else if (category === 'LLM Provider') endpoint = '/api/llm-agents';
  else if (category === 'Mobile Telephony') endpoint = '/api/telephony-agents';

  const res = await fetch(`${API_BASE}${endpoint}`, { headers });
  if (!res.ok) return [];

  const data = await res.json();
  if (Array.isArray(data)) {
    return data.map(mapBackendToIntegration);
  }
  return [];
}

export async function createIntegrationAgent(
  category: IntegrationCategory,
  payload: {
    name: string;
    provider_vendor: string;
    status?: string;
    config: any;
  },
  token: string | null
): Promise<Integration> {
  let authToken = await ensureValidToken(token);
  let headers = getAuthHeaders(authToken);

  let endpoint = '/api/stt-agents';
  if (category === 'TTS Agent') endpoint = '/api/tts-agents';
  else if (category === 'LLM Provider') endpoint = '/api/llm-agents';
  else if (category === 'Mobile Telephony') endpoint = '/api/telephony-agents';

  let res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  // If 401 Unauthorized, automatically renew session token and retry
  if (res.status === 401) {
    authToken = await ensureValidToken(null);
    headers = getAuthHeaders(authToken);
    res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || `Failed to create ${category}`);
  }

  const created = await res.json();
  return mapBackendToIntegration(created);
}

export async function updateIntegrationAgent(
  category: IntegrationCategory,
  id: string,
  payload: {
    name?: string;
    provider_vendor?: string;
    status?: string;
    config?: any;
  },
  token: string | null
): Promise<Integration> {
  let authToken = await ensureValidToken(token);
  let headers = getAuthHeaders(authToken);

  let endpoint = `/api/stt-agents/${id}`;
  if (category === 'TTS Agent') endpoint = `/api/tts-agents/${id}`;
  else if (category === 'LLM Provider') endpoint = `/api/llm-agents/${id}`;
  else if (category === 'Mobile Telephony') endpoint = `/api/telephony-agents/${id}`;

  let res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    authToken = await ensureValidToken(null);
    headers = getAuthHeaders(authToken);
    res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || `Failed to update ${category}`);
  }

  const updated = await res.json();
  return mapBackendToIntegration(updated);
}

export async function deleteIntegrationAgent(
  category: IntegrationCategory,
  id: string,
  token: string | null
): Promise<boolean> {
  let authToken = await ensureValidToken(token);
  let headers = getAuthHeaders(authToken);

  let endpoint = `/api/stt-agents/${id}`;
  if (category === 'TTS Agent') endpoint = `/api/tts-agents/${id}`;
  else if (category === 'LLM Provider') endpoint = `/api/llm-agents/${id}`;
  else if (category === 'Mobile Telephony') endpoint = `/api/telephony-agents/${id}`;

  let res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'DELETE',
    headers,
  });

  if (res.status === 401) {
    authToken = await ensureValidToken(null);
    headers = getAuthHeaders(authToken);
    res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || `Failed to delete ${category}`);
  }

  return true;
}
