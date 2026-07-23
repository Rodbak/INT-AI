import axios from 'axios';
import { supabase } from './supabaseClient';
import { neural, CORE, specialistNode, providerNode } from './neural';
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
  images?: string[],
): Promise<{ message: Message; usage?: { promptTokens: number; completionTokens: number; totalTokens: number; cost: number } }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session?.access_token ?? ''}`,
    },
    body: JSON.stringify({
      message: text,
      conversationId,
      model,
      provider,
      specialistId,
      regenerate,
      stream: true,
      ...(images && images.length ? { images } : {}),
    }),
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
  let routing: { provider?: string; model?: string; reasoning?: string } | null = null;
  let sources: { n: number; title: string; documentId?: string }[] = [];
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
              routing = { provider: parsed.provider, model: parsed.model, reasoning: parsed.reasoning };
              // Light up the responsible neurons in the nervous system: core →
              // the provider that answered → the specialist (if any).
              if (parsed.provider) {
                neural.fire(providerNode(parsed.provider), 1);
                neural.signal(CORE, providerNode(parsed.provider), 'accent');
              }
              if (specialist) {
                neural.fire(specialistNode(specialist.id), 1);
                neural.signal(
                  parsed.provider ? providerNode(parsed.provider) : CORE,
                  specialistNode(specialist.id),
                  'synapse',
                );
              }
            } else if (parsed.type === 'sources' && Array.isArray(parsed.sources)) {
              sources = parsed.sources;
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
      routing,
      sources: sources.length ? sources : undefined,
    },
    usage,
  };
}

/** Run one prompt against a single model (non-streaming) — used by the compare view. */
export async function runModelOnce(
  message: string,
  model?: string,
  provider?: string,
): Promise<{
  reply: string;
  provider?: string;
  model?: string;
  usage?: { totalTokens: number; cost: number };
  latencyMs: number;
}> {
  const t0 = performance.now();
  const { data } = await api.post('/chat', { message, model, provider, stream: false });
  return {
    reply: data.reply || '',
    provider: data.provider,
    model: data.model,
    usage: data.usage,
    latencyMs: Math.round(performance.now() - t0),
  };
}

// --- AI COO ---
export interface CooBrief {
  empty?: boolean;
  currency: string;
  cashOnHand: number;
  receivablesTotal: number;
  receivablesCount: number;
  receivables: { invoiceId: string; number: string; customer: string; phone?: string; outstanding: number; daysOverdue: number }[];
  topDebtor: { customer: string; outstanding: number; daysOverdue: number } | null;
  lowStock: { id: string; name: string; stock: number; reorderPoint: number; unit: string }[];
  lowStockCount: number;
  salesThisWeek: number;
  salesPrevWeek: number;
  trendPct: number | null;
  bestSeller: { name: string; revenue: number; marginPct: number } | null;
  cashRunwayWeeks: number | null;
  actions: { kind: string; title: string; detail: string; cta: string; payload: any }[];
  shopName?: string;
}

export async function getCooBrief(): Promise<CooBrief> {
  const { data } = await api.get<CooBrief>('/coo/brief');
  return data;
}

export interface CooReport {
  empty?: boolean;
  currency: string;
  monthLabel: string;
  thisMonth: { moneyIn: number; moneyOut: number; net: number; sales: number; profit: number };
  lastMonth: { moneyIn: number; moneyOut: number; net: number; sales: number; profit: number };
  topCustomers: { name: string; total: number }[];
  topProducts: { name: string; revenue: number; profit: number }[];
  weekday: { day: string; sales: number }[];
  busiestDay: string | null;
  dailySales: { date: string; label: string; sales: number }[];
}
export async function getReport(): Promise<CooReport> {
  const { data } = await api.get<CooReport>('/coo/reports');
  return data;
}

export interface CooInsight { narrative: string | null; generated: boolean }
export async function getInsight(): Promise<CooInsight> {
  const { data } = await api.get<CooInsight>('/coo/insights');
  return data;
}

// --- Proactive INT: nudges, briefing, drafted messages ---
export interface NudgeAction { type: 'restock' | 'remind' | 'navigate'; label: string; payload: Record<string, any> }
export interface Nudge {
  id: string;
  kind: 'low_stock' | 'debt' | 'cash' | 'win' | 'quiet';
  severity: 'urgent' | 'warning' | 'info' | 'good';
  emoji: string;
  title: string;
  body: string;
  action?: NudgeAction;
}
export async function getNudges(): Promise<Nudge[]> {
  const { data } = await api.get<{ nudges: Nudge[] }>('/coo/nudges');
  return data.nudges;
}

export interface Briefing {
  empty?: boolean;
  slot: 'morning' | 'evening';
  title: string;
  yesterday: { sales: number; count: number };
  today: { sales: number; count: number };
  cashOnHand: number;
  focus: string[];
  watch: string | null;
}
export async function getBriefing(slot: 'morning' | 'evening'): Promise<Briefing> {
  const { data } = await api.get<Briefing>(`/coo/briefing?slot=${slot}`);
  return data;
}

export async function draftMessage(input:
  | { purpose: 'reminder'; customer: string; amount: number }
  | { purpose: 'restock'; name: string; qty: number; unit: string }
): Promise<{ text: string; generated: boolean }> {
  const { data } = await api.post<{ text: string; generated: boolean }>('/coo/draft', input);
  return data;
}

// --- Phone push notifications ---
export async function getPushKey(): Promise<{ publicKey: string | null; enabled: boolean }> {
  const { data } = await api.get<{ publicKey: string | null; enabled: boolean }>('/push/key');
  return data;
}
export async function savePushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
  await api.post('/push/subscribe', { subscription });
}
export async function removePushSubscription(endpoint: string): Promise<void> {
  await api.post('/push/unsubscribe', { endpoint });
}
export async function sendTestPush(): Promise<{ sent: number }> {
  const { data } = await api.post<{ sent: number }>('/push/test', {});
  return data;
}

export interface SetupStatus { needsSetup: boolean; shopName: string }
export async function getSetupStatus(): Promise<SetupStatus> {
  const { data } = await api.get<SetupStatus>('/coo/setup');
  return data;
}
export async function completeSetup(input: {
  shopName: string;
  products?: { name: string; price: number; stock: number; cost?: number; unit?: string }[];
  customers?: { name: string; phone?: string }[];
}): Promise<{ ok: boolean; shopName: string }> {
  const { data } = await api.post<{ ok: boolean; shopName: string }>('/coo/setup', input);
  return data;
}

export async function approveCooAction(action: { kind: string; title: string; detail?: string; payload?: any }) {
  const { data } = await api.post<{ id: string; status: string; message: string }>('/coo/actions', action);
  return data;
}

// --- Business management (customers, products, sales, payments, expenses) ---
export interface CooCustomer { id: string; name: string; phone?: string | null; owed: number }
export interface CooProduct { id: string; name: string; sku?: string | null; price: number; cost: number; stock: number; reorderPoint: number; unit: string; low: boolean }
export interface CooSale { id: string; number: string; customer: string; amount: number; status: string; outstanding: number; issuedAt: string }
export interface CooExpense { id: string; category: string; amount: number; note?: string | null; spentAt: string }

export async function getCustomers(): Promise<CooCustomer[]> {
  const { data } = await api.get<{ customers: CooCustomer[] }>('/coo/customers');
  return data.customers;
}
export async function addCustomer(input: { name: string; phone?: string }): Promise<CooCustomer> {
  const { data } = await api.post<{ customer: CooCustomer }>('/coo/customers', input);
  return data.customer;
}

export async function getProducts(): Promise<CooProduct[]> {
  const { data } = await api.get<{ products: CooProduct[] }>('/coo/products');
  return data.products;
}
export async function addProduct(input: { name: string; price: number; cost: number; stock: number; reorderPoint: number; unit: string; sku?: string }): Promise<CooProduct> {
  const { data } = await api.post<{ product: CooProduct }>('/coo/products', input);
  return data.product;
}
export async function updateProduct(id: string, input: Partial<{ name: string; price: number; cost: number; stock: number; addStock: number; reorderPoint: number; unit: string }>): Promise<CooProduct> {
  const { data } = await api.patch<{ product: CooProduct }>(`/coo/products/${id}`, input);
  return data.product;
}
export async function deleteProduct(id: string): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/coo/products/${id}`);
  return data;
}
export async function updateCustomer(id: string, input: { name?: string; phone?: string }): Promise<CooCustomer> {
  const { data } = await api.patch<{ customer: CooCustomer }>(`/coo/customers/${id}`, input);
  return data.customer;
}
export async function deleteCustomer(id: string): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/coo/customers/${id}`);
  return data;
}

export async function getSales(): Promise<CooSale[]> {
  const { data } = await api.get<{ sales: CooSale[] }>('/coo/sales');
  return data.sales;
}
export async function recordSale(input: { customerId?: string; items?: { productId: string; qty: number; unitPrice?: number }[]; amount?: number; paidNow: boolean; method?: string; dueInDays?: number }): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/coo/sales', input);
  return data;
}
export async function deleteSale(id: string): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/coo/sales/${id}`);
  return data;
}
export async function recordPayment(input: { invoiceId?: string; customerId?: string; amount?: number; method?: string }): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/coo/payments', input);
  return data;
}

export async function getExpenses(): Promise<CooExpense[]> {
  const { data } = await api.get<{ expenses: CooExpense[] }>('/coo/expenses');
  return data.expenses;
}
export async function recordExpense(input: { category: string; amount: number; note?: string }): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/coo/expenses', input);
  return data;
}
export async function updateExpense(id: string, input: { category?: string; amount?: number; note?: string }): Promise<CooExpense> {
  const { data } = await api.patch<{ expense: CooExpense }>(`/coo/expenses/${id}`, input);
  return data.expense;
}
export async function deleteExpense(id: string): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/coo/expenses/${id}`);
  return data;
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

/** Create a knowledge document from raw text; the server chunks + indexes it. */
export async function createTextDocument(data: {
  title: string;
  content: string;
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
