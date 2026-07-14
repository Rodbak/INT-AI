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
  status: 'online' | 'busy' | 'offline';
  description: string;
}

export interface AITeam {
  id: string;
  name: string;
  description: string;
  members: string[];
  status: 'active' | 'idle';
}

export interface Automation {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  type: 'pdf' | 'doc' | 'sheet' | 'text';
  size: string;
  updatedAt: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
}

export interface Connection {
  id: string;
  name: string;
  type: 'api' | 'oauth' | 'database' | 'webhook';
  status: 'connected' | 'disconnected' | 'error';
}

export interface UsageMetric {
  date: string;
  tokens: number;
  cost: number;
}
