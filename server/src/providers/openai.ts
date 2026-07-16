import OpenAI from 'openai';
import type { Provider, ProviderConfig, StreamChunk, ChatMessage, ModelCapability, ProviderName } from '../types.js';

export class OpenAIProvider implements Provider {
  name: ProviderName = 'openai';
  private apiKey: string;
  private client?: OpenAI;
  private config: ProviderConfig;

  constructor(apiKey: string, config: ProviderConfig) {
    this.apiKey = apiKey;
    this.config = config;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: this.apiKey });
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
      let promptTokens = 0;
      let completionTokens = 0;

      try {
        const stream = await this.getClient().chat.completions.create(
          {
            model: model || config.model,
            max_tokens: config.maxTokens || 4096,
            messages: openaiMessages,
            stream: true,
          },
          { signal: controller.signal },
        );

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
      yield { type: 'error', error: error.message || 'OpenAI API error' };
    }
  }

  getCapabilities(): ModelCapability[] {
    return [
      {
        id: 'gpt-4o',
        provider: 'openai',
        name: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128000,
        inputPricePerMillion: 2.5,
        outputPricePerMillion: 10.0,
        latencyMs: 700,
        qualityScore: 0.95,
        taskTypes: ['chat', 'code', 'analysis', 'reasoning', 'creative'],
      },
      {
        id: 'gpt-4o-mini',
        provider: 'openai',
        name: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        contextWindow: 128000,
        inputPricePerMillion: 0.15,
        outputPricePerMillion: 0.6,
        latencyMs: 250,
        qualityScore: 0.82,
        taskTypes: ['chat', 'analysis', 'code'],
      },
      {
        id: 'o3',
        provider: 'openai',
        name: 'o3',
        displayName: 'OpenAI o3',
        contextWindow: 200000,
        inputPricePerMillion: 10.0,
        outputPricePerMillion: 40.0,
        latencyMs: 3000,
        qualityScore: 0.99,
        taskTypes: ['reasoning', 'code', 'analysis'],
      },
    ];
  }
}
