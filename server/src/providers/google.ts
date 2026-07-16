import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Provider, ProviderConfig, StreamChunk, ChatMessage, ModelCapability, ProviderName } from '../types.js';

export class GoogleProvider implements Provider {
  name: ProviderName = 'google';
  private apiKey: string;
  private client?: GoogleGenerativeAI;
  private config: ProviderConfig;

  constructor(apiKey: string, config: ProviderConfig) {
    this.apiKey = apiKey;
    this.config = config;
  }

  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      this.client = new GoogleGenerativeAI(this.apiKey);
    }
    return this.client;
  }

  async *streamChat(
    messages: ChatMessage[],
    model: string,
    config: ProviderConfig,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const geminiModel = model || config.model;
    const genModel = this.getClient().getGenerativeModel({ model: geminiModel });

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1]?.content || '';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      let promptTokens = 0;
      let completionTokens = 0;

      try {
        const chat = genModel.startChat({ history });
        const result = await chat.sendMessageStream(lastMessage, { signal: controller.signal });

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            yield { type: 'text', content: text };
          }
        }

        const finalResponse = await result.response;
        const usageMetadata = finalResponse.usageMetadata;
        if (usageMetadata) {
          promptTokens = usageMetadata.promptTokenCount || 0;
          completionTokens = usageMetadata.candidatesTokenCount || 0;
        }
      } finally {
        clearTimeout(timeout);
      }

      yield {
        type: 'usage',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          cost: 0,
        },
      };

      yield { type: 'done' };
    } catch (error: any) {
      yield { type: 'error', error: error.message || 'Google AI API error' };
    }
  }

  getCapabilities(): ModelCapability[] {
    return [
      {
        id: 'gemini-2.5-pro-preview-03-25',
        provider: 'google',
        name: 'gemini-2.5-pro-preview-03-25',
        displayName: 'Gemini 2.5 Pro',
        contextWindow: 1000000,
        inputPricePerMillion: 1.25,
        outputPricePerMillion: 10.0,
        latencyMs: 900,
        qualityScore: 0.94,
        taskTypes: ['chat', 'code', 'analysis', 'reasoning', 'creative'],
      },
      {
        id: 'gemini-2.0-flash',
        provider: 'google',
        name: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        inputPricePerMillion: 0.1,
        outputPricePerMillion: 0.4,
        latencyMs: 300,
        qualityScore: 0.85,
        taskTypes: ['chat', 'analysis', 'code'],
      },
    ];
  }
}
