import OpenAI from 'openai';
import type { Provider, ProviderConfig, StreamChunk, ChatMessage, ModelCapability, ProviderName } from '../types.js';

export class OpenRouterProvider implements Provider {
  name: ProviderName = 'openrouter';
  private apiKey: string;
  private client?: OpenAI;
  private config: ProviderConfig;

  constructor(apiKey: string, config: ProviderConfig) {
    this.apiKey = apiKey;
    this.config = config;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://int-ai.app',
          'X-Title': 'INT-AI',
        },
      });
    }
    return this.client;
  }

  async *streamChat(
    messages: ChatMessage[],
    model: string,
    config: ProviderConfig,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      const stream = this.getClient().chat.completions.create({
        model: model || config.model,
        max_tokens: config.maxTokens || 4096,
        messages: openaiMessages,
        stream: true,
        signal: controller.signal,
      }) as unknown as AsyncIterable<any>;

      let promptTokens = 0;
      let completionTokens = 0;

      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            yield { type: 'text', content: delta };
          }

          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens || 0;
            completionTokens = chunk.usage.completion_tokens || 0;
          }
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
      yield { type: 'error', error: error.message || 'OpenRouter API error' };
    }
  }

  getCapabilities(): ModelCapability[] {
    return [
      {
        id: 'anthropic/claude-sonnet-4',
        provider: 'openrouter',
        name: 'anthropic/claude-sonnet-4',
        displayName: 'Claude Sonnet 4 (OpenRouter)',
        contextWindow: 200000,
        inputPricePerMillion: 3.0,
        outputPricePerMillion: 15.0,
        latencyMs: 800,
        qualityScore: 0.92,
        taskTypes: ['chat', 'code', 'analysis', 'reasoning', 'creative'],
      },
      {
        id: 'openai/gpt-4o',
        provider: 'openrouter',
        name: 'openai/gpt-4o',
        displayName: 'GPT-4o (OpenRouter)',
        contextWindow: 128000,
        inputPricePerMillion: 2.5,
        outputPricePerMillion: 10.0,
        latencyMs: 700,
        qualityScore: 0.95,
        taskTypes: ['chat', 'code', 'analysis', 'reasoning', 'creative'],
      },
      {
        id: 'google/gemini-2.0-flash-001',
        provider: 'openrouter',
        name: 'google/gemini-2.0-flash-001',
        displayName: 'Gemini 2.0 Flash (OpenRouter)',
        contextWindow: 1000000,
        inputPricePerMillion: 0.1,
        outputPricePerMillion: 0.4,
        latencyMs: 300,
        qualityScore: 0.85,
        taskTypes: ['chat', 'analysis', 'code'],
      },
      {
        id: 'meta-llama/llama-4-maverick',
        provider: 'openrouter',
        name: 'meta-llama/llama-4-maverick',
        displayName: 'Llama 4 Maverick (OpenRouter)',
        contextWindow: 128000,
        inputPricePerMillion: 0.15,
        outputPricePerMillion: 0.6,
        latencyMs: 500,
        qualityScore: 0.88,
        taskTypes: ['chat', 'code', 'analysis', 'reasoning', 'creative'],
      },
    ];
  }
}
