import axios from 'axios';
import { supabase } from './supabaseClient';
import { neural, CORE, specialistNode } from './neural';
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

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') || '';
const API_PREFIX = '/api';
export const API_BASE_URL = API_BASE ? `${API_BASE}${API_PREFIX}` : API_PREFIX;

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
  baseURL: API_BASE_URL,
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
  (response) => {
    // A 200 with an HTML body (instead of JSON) almost always means the
    // request never reached the API function and got the SPA shell back
    // instead — surface that clearly instead of letting callers treat the
    // HTML string as if it were the expected array/object.
    const contentType = String(response.headers['content-type'] || '');
    if (!contentType.includes('application/json')) {
      throw new Error(
        `Expected a JSON response from ${response.config.url} but got "${contentType || 'unknown content type'}". ` +
          'The request likely never reached the backend API — check that /api/* is routing to the serverless function.',
      );
    }
    return response;
  },
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
  const { data } = await api.get<Conversation[]>('/conversations');
  return data;
}

export async function createConversation(title: string) {
  const { data } = await api.post<Conversation>('/conversations', {
    title,
  });
  return data;
}

export async function updateConversation(id: string, data: { title?: string }) {
  const { data: updated } = await api.patch<Conversation>(`/conversations/${id}`, data);
  return updated;
}

export async function deleteConversation(id: string) {
  await api.delete(`/conversations/${id}`);
}

interface BackendMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: string | null;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  cost?: number | null;
  createdAt: string;
}

// Loads a single conversation with its full message history and maps the
// backend's persisted message shape (content/createdAt/split token counts)
// onto the frontend Message shape the chat UI renders. System messages are
// dropped since they're internal routing/RAG context, not user-facing turns.
export async function getConversation(id: string): Promise<Message[]> {
  const { data } = await api.get<{ messages?: BackendMessage[] }>(`/conversations/${id}`);
  return (data.messages || [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      text: m.content,
      timestamp: m.createdAt,
      model: m.model || undefined,
      tokens: (m.tokensIn || 0) + (m.tokensOut || 0) || undefined,
      cost: m.cost ?? undefined,
    }));
}

export async function sendMessage(
  conversationId: string,
  text: string,
  model?: string,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
  provider?: string,
  specialistId?: string,
  regenerate?: boolean,
): Promise<{ message: Message; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; cost: number } }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ message: text, conversationId, model, provider, specialistId, regenerate, stream: true }),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to send message');
  }

  const responseContentType = response.headers.get('content-type') || '';
  if (!responseContentType.includes('text/event-stream')) {
    throw new Error(
      `Expected a streaming reply but got "${responseContentType || 'unknown content type'}" — ` +
        'the request likely never reached the chat API. Check that /api/* is routing to the serverless function.',
    );
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let usage: { promptTokens: number; completionTokens: number; totalTokens: number; cost: number } | undefined;
  let streamError: string | undefined;
  let specialist: { id: string; name: string } | null = null;
  let usedModel = model;

  if (reader) {
    outer: while (true) {
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
            } else if (parsed.type === 'meta') {
              specialist = parsed.specialist || null;
              usedModel = parsed.model || usedModel;
              // Light up the responsible neuron in the nervous system.
              if (specialist) {
                neural.fire(specialistNode(specialist.id), 1);
                neural.signal(CORE, specialistNode(specialist.id), 'synapse');
              }
            } else if (parsed.type === 'usage' && parsed.usage) {
              usage = parsed.usage;
            } else if (parsed.type === 'error') {
              streamError = parsed.error || 'The model provider returned an error';
              await reader.cancel().catch(() => {});
              break outer;
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  }

  if (streamError) {
    throw new Error(streamError);
  }

  return {
    message: {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: fullText,
      timestamp: new Date().toISOString(),
      model: usedModel || 'auto',
      tokens: usage?.totalTokens,
      cost: usage?.cost,
      specialist,
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
  const { data } = await api.post<{ id: string; url: string }>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchModels() {
  const { data } = await api.get<ModelOption[]>('/models');
  return data;
}

export async function fetchSpecialists() {
  const { data } = await api.get<Specialist[]>('/specialists');
  return data;
}

export async function createSpecialist(data: {
  name: string;
  role: string;
  description?: string;
  model?: string;
  capabilities?: string[];
  active?: boolean;
}) {
  const response = await api.post<Specialist>('/specialists', data);
  return response.data;
}

export async function updateSpecialist(
  id: string,
  data: {
    name?: string;
    role?: string;
    description?: string;
    model?: string;
    capabilities?: string[];
    active?: boolean;
  },
) {
  const response = await api.patch<Specialist>(`/specialists/${id}`, data);
  return response.data;
}

export async function deleteSpecialist(id: string) {
  await api.delete(`/specialists/${id}`);
}

export async function fetchTeams() {
  const { data } = await api.get<AITeam[]>('/teams');
  return data;
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

export type TeamRunEvent =
  | { type: 'team'; team: { id: string; name: string }; stages: Array<{ specialist: { id: string; name: string; role: string } }> }
  | { type: 'stage'; index: number; status: 'start' | 'done' | 'error'; specialist?: { id: string; name: string; role: string }; error?: string }
  | { type: 'text'; index: number; content: string }
  | { type: 'error'; error: string }
  | { type: 'done' };

// Runs a team orchestration and calls onEvent for each streamed SSE event.
export async function runTeam(
  teamId: string,
  message: string,
  onEvent: (event: TeamRunEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const response = await fetch(`${API_BASE_URL}/teams/${teamId}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ message }),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Team run failed');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  if (!reader) return;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') continue;
        try {
          onEvent(JSON.parse(payload) as TeamRunEvent);
        } catch {
          /* ignore parse errors */
        }
      }
    }
  }
}

export async function fetchAutomations() {
  const { data } = await api.get<Automation[]>('/automations');
  return data;
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
  const { data } = await api.get<KnowledgeDoc[]>('/knowledge');
  return data;
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
  const { data } = await api.get<PromptTemplate[]>('/prompts');
  return data;
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
  const { data } = await api.get<Connection[]>('/connections');
  return data;
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

export async function initiateOAuth(provider: string, workspaceId: string) {
  const { data } = await api.get<{ authUrl: string; state: string }>(`/connections/oauth/authorize/${provider}`, {
    params: { workspaceId },
  });
  return data;
}

export async function refreshConnection(provider: string, connectionId: string) {
  const { data } = await api.post(`/connections/oauth/refresh/${provider}/${connectionId}`);
  return data;
}

export async function fetchWorkspaces() {
  const { data } = await api.get<any[]>('/workspaces');
  return data;
}

export async function createWorkspace(data: { name: string; slug: string; plan?: string }) {
  const response = await api.post('/workspaces', data);
  return response.data;
}

export async function updateWorkspace(id: string, data: { name?: string; plan?: string }) {
  const response = await api.patch(`/workspaces/${id}`, data);
  return response.data;
}

export async function deleteWorkspace(id: string) {
  await api.delete(`/workspaces/${id}`);
}

export async function inviteWorkspaceMember(workspaceId: string, email: string, role: string) {
  const response = await api.post(`/workspaces/${workspaceId}/members`, { email, role });
  return response.data;
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  await api.delete(`/workspaces/${workspaceId}/members/${userId}`);
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
  const { data } = await api.get<Invoice[]>('/billing/invoices');
  return data;
}

export async function createCheckout(planId: string) {
  const { data } = await api.post<{ checkoutUrl: string }>('/billing/checkout', { planId });
  return data;
}

export async function fetchAdminStats() {
  const { data } = await api.get<AdminStats>('/admin/stats');
  return data;
}

export async function fetchAdminUsers(page = 1, limit = 20, search = '', role = '') {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (search) params.set('search', search);
  if (role) params.set('role', role);
  const { data } = await api.get<{ users: any[]; total: number; page: number; totalPages: number }>(`/admin/users?${params.toString()}`);
  return data;
}

export async function updateAdminUser(id: string, data: { role?: string }) {
  const response = await api.patch(`/admin/users/${id}`, data);
  return response.data;
}

export async function deleteAdminUser(id: string) {
  await api.delete(`/admin/users/${id}`);
}

export async function fetchAdminModels() {
  const { data } = await api.get<any[]>('/admin/models');
  return data;
}

export async function createAdminModel(data: any) {
  const response = await api.post('/admin/models', data);
  return response.data;
}

export async function updateAdminModel(id: string, data: any) {
  const response = await api.patch(`/admin/models/${id}`, data);
  return response.data;
}

export async function deleteAdminModel(id: string) {
  await api.delete(`/admin/models/${id}`);
}

export async function fetchBilling() {
  const { data } = await api.get<any>('/billing');
  return data;
}

export default api;
