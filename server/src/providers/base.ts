import type { ProviderName, StreamChunk, ChatMessage, ModelCapability } from '../types.js';

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
