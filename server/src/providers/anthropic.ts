import Anthropic from '@anthropic-ai/sdk';
import type { Provider, ProviderConfig, StreamChunk, ChatMessage, ModelCapability, ProviderName } from '../types.js';

export class AnthropicProvider implements Provider {
  name: ProviderName = 'anthropic';
  private apiKey: string;
  private client?: Anthropic;
  private config: ProviderConfig;

  constructor(apiKey: string, config: ProviderConfig) {
    this.apiKey = apiKey;
    this.config = config;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async *streamChat(
    messages: ChatMessage[],
    model: string,
    config: ProviderConfig,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      let promptTokens = 0;
      let completionTokens = 0;

      try {
        const stream = this.getClient().messages.stream({
          model: model || config.model,
          max_tokens: config.maxTokens || 4096,
          messages: anthropicMessages,
          signal: controller.signal,
        });

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            yield { type: 'text', content: event.delta.text };
          }

          if (event.type === 'message_start' && event.message.usage) {
            promptTokens = event.message.usage.input_tokens || 0;
          }

          if (event.type === 'message_delta' && event.usage) {
            completionTokens = event.usage.output_tokens || 0;
          }
        }

        const finalMessage = await stream.finalMessage();
        promptTokens = finalMessage.usage.input_tokens;
        completionTokens = finalMessage.usage.output_tokens;
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
      yield { type: 'error', error: error.message || 'Anthropic API error' };
    }
  }

  getCapabilities(): ModelCapability[] {
    return [
      {
        id: 'claude-sonnet-5',
        provider: 'anthropic',
        name: 'claude-sonnet-5',
        displayName: 'Claude Sonnet 5',
        contextWindow: 1000000,
        inputPricePerMillion: 3.0,
        outputPricePerMillion: 15.0,
        latencyMs: 800,
        qualityScore: 0.92,
        taskTypes: ['chat', 'code', 'analysis', 'reasoning', 'creative'],
      },
      {
        id: 'claude-opus-4-8',
        provider: 'anthropic',
        name: 'claude-opus-4-8',
        displayName: 'Claude Opus 4.8',
        contextWindow: 1000000,
        inputPricePerMillion: 5.0,
        outputPricePerMillion: 25.0,
        latencyMs: 1500,
        qualityScore: 0.98,
        taskTypes: ['chat', 'code', 'analysis', 'reasoning', 'creative'],
      },
      {
        id: 'claude-haiku-4-5',
        provider: 'anthropic',
        name: 'claude-haiku-4-5',
        displayName: 'Claude Haiku 4.5',
        contextWindow: 200000,
        inputPricePerMillion: 1.0,
        outputPricePerMillion: 5.0,
        latencyMs: 300,
        qualityScore: 0.78,
        taskTypes: ['chat', 'analysis'],
      },
    ];
  }
}
