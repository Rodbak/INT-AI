import axios from 'axios';
import { supabase } from './supabaseClient';
import type {
  User,
  Conversation,
  Message,
  ModelOption,
  Specialist,
  AITeam,
  Automation,
  KnowledgeDoc,
  PromptTemplate,
  Connection,
  UsageSummary,
  UsageBreakdownItem,
  BillingPlan,
  Invoice,
  AdminStats,
} from '../types/index';

const API_BASE = '/api';

function extractMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'error' in error) {
    const nested = (error as Record<string, unknown>).error;
    if (typeof nested === 'string') return nested;
    if (nested && typeof nested === 'object' && 'message' in nested) {
      const msg = (nested as Record<string, unknown>).message;
      if (typeof msg === 'string') return msg;
    }
    return JSON.stringify(nested ?? error);
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
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
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
    return Promise.reject(new Error(extractMessage(error)));
  },
);

export async function getCurrentUser() {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data.user;
}

export async function fetchConversations() {
  const { data } = await api.get<{ conversations: Conversation[] }>('/conversations');
  return data.conversations;
}

export async function createConversation(title: string) {
  const { data } = await api.post<{ conversation: Conversation }>('/conversations', {
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
): Promise<{ message: Message; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; cost: number } }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ message: text, conversationId, model, stream: true }),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to send message');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let usage: { promptTokens: number; completionTokens: number; totalTokens: number; cost: number } | undefined;

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
            if (parsed.type === 'text' && parsed.content) {
              fullText += parsed.content;
              onChunk?.(parsed.content);
            } else if (parsed.type === 'usage' && parsed.usage) {
              usage = parsed.usage;
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  }

  return {
    message: {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: fullText,
      timestamp: new Date().toISOString(),
      model: model || 'auto',
      tokens: usage?.totalTokens,
      cost: usage?.cost,
    },
    usage,
  };
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const { data } = await api.post<{ text: string }>('/voice/transcribe', blob, {
    headers: { 'Content-Type': blob.type || 'audio/webm' },
  });
  return data.text;
}

export async function synthesizeSpeech(text: string, voice?: string): Promise<Blob> {
  const { data } = await api.post('/voice/speech', { text, voice }, {
    responseType: 'blob',
  });
  return data as Blob;
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
  const { data } = await api.get<{ models: ModelOption[] }>('/models');
  return data.models;
}

export async function fetchSpecialists() {
  const { data } = await api.get<{ specialists: Specialist[] }>('/specialists');
  return data.specialists;
}

export async function fetchTeams() {
  const { data } = await api.get<{ teams: AITeam[] }>('/teams');
  return data.teams;
}

export async function createTeam(data: {
  name: string;
  description?: string;
  workspaceId: string;
  members?: Array<{ specialistId: string; order?: number }>;
}) {
  const response = await api.post('/teams', data);
  return response.data;
}

export async function updateTeam(id: string, data: {
  name?: string;
  description?: string;
  members?: Array<{ specialistId: string; order?: number }>;
}) {
  const response = await api.patch(`/teams/${id}`, data);
  return response.data;
}

export async function deleteTeam(id: string) {
  await api.delete(`/teams/${id}`);
}

export async function fetchAutomations() {
  const { data } = await api.get<{ automations: Automation[] }>('/automations');
  return data.automations;
}

export async function createAutomation(data: {
  name: string;
  description?: string;
  triggerType: 'webhook' | 'schedule' | 'manual';
  triggerConfig?: Record<string, any>;
  steps?: any[];
  workspaceId: string;
}) {
  const response = await api.post('/automations', data);
  return response.data;
}

export async function updateAutomation(id: string, data: {
  name?: string;
  description?: string;
  triggerType?: 'webhook' | 'schedule' | 'manual';
  triggerConfig?: Record<string, any>;
  steps?: any[];
  active?: boolean;
}) {
  const response = await api.patch(`/automations/${id}`, data);
  return response.data;
}

export async function deleteAutomation(id: string) {
  await api.delete(`/automations/${id}`);
}

export async function executeAutomation(id: string) {
  const response = await api.post(`/automations/${id}/execute`);
  return response.data;
}

export async function fetchKnowledge() {
  const { data } = await api.get<{ docs: KnowledgeDoc[] }>('/knowledge');
  return data.docs;
}

export async function createDocument(data: {
  title: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  workspaceId: string;
}) {
  const response = await api.post('/knowledge', data);
  return response.data;
}

export async function deleteDocument(id: string) {
  await api.delete(`/knowledge/${id}`);
}

export async function fetchPrompts() {
  const { data } = await api.get<{ prompts: PromptTemplate[] }>('/prompts');
  return data.prompts;
}

export async function createPrompt(data: {
  title: string;
  content: string;
  tags?: string[];
  workspaceId: string;
}) {
  const response = await api.post('/prompts', data);
  return response.data;
}

export async function updatePrompt(id: string, data: {
  title?: string;
  content?: string;
  tags?: string[];
}) {
  const response = await api.patch(`/prompts/${id}`, data);
  return response.data;
}

export async function deletePrompt(id: string) {
  await api.delete(`/prompts/${id}`);
}

export async function fetchConnections() {
  const { data } = await api.get<{ connections: Connection[] }>('/connections');
  return data.connections;
}

export async function createConnection(data: {
  provider: 'google' | 'microsoft' | 'slack' | 'github';
  name: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  workspaceId: string;
}) {
  const response = await api.post('/connections', data);
  return response.data;
}

export async function deleteConnection(id: string) {
  await api.delete(`/connections/${id}`);
}

export async function fetchUsageSummary(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const { data } = await api.get<UsageSummary>(`/usage/summary?${params.toString()}`);
  return data;
}

export async function fetchUsageBreakdown(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const { data } = await api.get<UsageBreakdownItem[]>(`/usage/breakdown?${params.toString()}`);
  return data;
}

export async function fetchPlans() {
  const { data } = await api.get<BillingPlan[]>('/billing/plans');
  return data;
}

export async function fetchInvoices() {
  const { data } = await api.get<{ invoices: Invoice[] }>('/billing/invoices');
  return data.invoices;
}

export async function createCheckout(planId: string) {
  const { data } = await api.post<{ checkoutUrl: string }>('/billing/checkout', { planId });
  return data;
}

export async function fetchAdminStats() {
  const { data } = await api.get<AdminStats>('/admin/stats');
  return data;
}

export async function fetchBilling() {
  const { data } = await api.get<any>('/billing');
  return data;
}

export default api;
