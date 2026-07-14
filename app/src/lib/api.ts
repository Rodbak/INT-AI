import axios from 'axios';
import type { User } from '../types';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
            refreshToken,
          });
          localStorage.setItem('auth_token', data.accessToken);
          localStorage.setItem('refresh_token', data.refreshToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(error.config);
        } catch {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error.response?.data || { error: 'Network error' });
  },
);

export async function login(email: string, password: string) {
  const { data } = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
    '/auth/login',
    { email, password },
  );
  return data;
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function getCurrentUser() {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data.user;
}

export async function refreshTokenRequest(refreshToken: string) {
  const { data } = await api.post<{ accessToken: string; refreshToken: string }>(
    '/auth/refresh',
    { refreshToken },
  );
  return data;
}

export async function fetchConversations() {
  const { data } = await api.get<{ conversations: import('../types').Conversation[] }>('/conversations');
  return data.conversations;
}

export async function createConversation(title: string) {
  const { data } = await api.post<{ conversation: import('../types').Conversation }>('/conversations', {
    title,
  });
  return data.conversation;
}

export async function deleteConversation(id: string) {
  await api.delete(`/conversations/${id}`);
}

export async function sendMessage(
  conversationId: string,
  text: string,
  model?: string,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<import('../types').Message> {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
    body: JSON.stringify({ text, model }),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to send message');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let assistantMessage: import('../types').Message | null = null;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              fullText += parsed.text;
              onChunk?.(parsed.text);
            }
            if (parsed.message) {
              assistantMessage = parsed.message;
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  }

  if (assistantMessage) {
    assistantMessage.text = fullText;
    return assistantMessage;
  }

  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    text: fullText,
    timestamp: new Date().toISOString(),
    model: model || 'auto',
  };
}

export async function uploadFile(file: File): Promise<{ id: string; url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchModels() {
  const { data } = await api.get<{ models: import('../types').ModelOption[] }>('/models');
  return data.models;
}

export async function fetchSpecialists() {
  const { data } = await api.get<{ specialists: import('../types').Specialist[] }>('/specialists');
  return data.specialists;
}

export async function fetchTeams() {
  const { data } = await api.get<{ teams: import('../types').AITeam[] }>('/teams');
  return data.teams;
}

export async function fetchAutomations() {
  const { data } = await api.get<{ automations: import('../types').Automation[] }>('/automations');
  return data.automations;
}

export async function fetchKnowledge() {
  const { data } = await api.get<{ docs: import('../types').KnowledgeDoc[] }>('/knowledge');
  return data.docs;
}

export async function fetchPrompts() {
  const { data } = await api.get<{ prompts: import('../types').PromptTemplate[] }>('/prompts');
  return data.prompts;
}

export async function fetchConnections() {
  const { data } = await api.get<{ connections: import('../types').Connection[] }>('/connections');
  return data.connections;
}

export async function fetchUsage() {
  const { data } = await api.get<{ metrics: import('../types').UsageMetric[] }>('/usage');
  return data.metrics;
}

export async function fetchAdminStats() {
  const { data } = await api.get<any>('/admin/stats');
  return data;
}

export async function fetchBilling() {
  const { data } = await api.get<any>('/billing');
  return data;
}

export default api;
