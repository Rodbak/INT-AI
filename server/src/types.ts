import type { Request } from 'express';

export type ProviderName = 'anthropic' | 'openai' | 'google' | 'openrouter';

export type UserRole = 'user' | 'admin';

export type TaskType = 'chat' | 'code' | 'analysis' | 'reasoning' | 'creative';

export interface AuthenticatedRequest extends Request<Record<string, string>> {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export interface ApiError extends Error {
  statusCode?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  messages?: ChatMessage[];
  provider?: ProviderName;
  model?: string;
  stream?: boolean;
}

export interface ModelCapability {
  id: string;
  provider: ProviderName;
  name: string;
  displayName: string;
  contextWindow: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  latencyMs: number;
  qualityScore: number;
  taskTypes: TaskType[];
}

export interface ProviderConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
}

export interface Provider {
  name: ProviderName;
  streamChat(
    messages: ChatMessage[],
    model: string,
    config: ProviderConfig,
  ): AsyncGenerator<StreamChunk, void, unknown>;
  getCapabilities(): ModelCapability[];
}

export type StreamChunk =
  | { type: 'text'; content: string }
  | {
      type: 'usage';
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cost: number;
      };
    }
  | { type: 'error'; error: string }
  | { type: 'done' };

export interface RouteDecision {
  provider: ProviderName;
  model: string;
  reasoning: string;
}

export interface UsageLog {
  userId: string;
  conversationId?: string;
  provider: ProviderName;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  latencyMs: number;
  taskType: TaskType;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: UserRole;
    };
  }
}
