export interface LiveMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status?: 'pending' | 'done' | 'error';
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  avatarUrl?: string;
}

export interface Workspace {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  model: string;
  messages: Message[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  tokens?: number;
  cost?: number;
  model?: string;
  status?: 'error';
  specialist?: { id: string; name: string } | null;
  /** How this turn was routed — provider that answered + why. */
  routing?: { provider?: string; model?: string; reasoning?: string } | null;
  /** Retrieved knowledge sources cited in this answer. */
  sources?: { n: number; title: string; documentId?: string }[];
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  inputCost: number;
  outputCost: number;
  enabled: boolean;
}

export interface Specialist {
  id: string;
  name: string;
  role: string;
  model: string;
  active: boolean;
  description: string;
  capabilities: string[];
}

export interface SpecialistRef {
  id: string;
  name: string;
}

export interface TeamMember {
  id: string;
  specialist: SpecialistRef;
}

export interface AITeam {
  id: string;
  name: string;
  description: string;
  members: Array<{ id: string; specialist: { id: string; name: string; role: string } }>;
  workspace: { id: string; name: string };
  creator: { id: string; email: string; name: string };
  status: 'active' | 'idle';
}

export type AutomationTrigger = 'webhook' | 'schedule' | 'manual';

export interface Automation {
  id: string;
  name: string;
  triggerType: string;
  action: string;
  enabled: boolean;
  workspace: { id: string; name: string };
  creator: { id: string; email: string; name: string };
  active: boolean;
  triggerConfig: Record<string, any>;
  steps: any[];
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  filename: string;
  type: 'pdf' | 'doc' | 'sheet' | 'text';
  size: number;
  createdAt: string;
  updatedAt: string;
  workspace: { id: string; name: string };
  uploader: { id: string; email: string; name: string };
  url: string;
  mimeType: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  workspace: { id: string; name: string };
  creator: { id: string; email: string; name: string };
}

export interface Connection {
  id: string;
  name: string;
  provider: string;
  status: 'connected' | 'disconnected' | 'error';
  workspace: { id: string; name: string };
  expiresAt?: string;
}

export interface UsageMetric {
  date: string;
  tokens: number;
  cost: number;
}

export interface UsageSummary {
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  conversationCount: number;
  period: { from?: string; to?: string };
}

export interface UsageBreakdownItem {
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  count: number;
}

export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: string;
  features: string[];
  active: boolean;
}

export interface Invoice {
  id: string;
  userId: string;
  planId: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  plan: { id: string; name: string; price: number; interval: string };
}

export interface AdminStats {
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalCost: number;
  activeSpecialists: number;
  totalTeams: number;
  totalDocuments: number;
  totalConnections: number;
  recentActivity: Array<{ date: string; cost: number }>;
  modelDistribution: Array<{ model: string; count: number }>;
}
