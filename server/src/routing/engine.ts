import type { ChatMessage, ProviderName, RouteDecision, StreamChunk, TaskType, UsageLog } from '../types.js';
import { classifyRequest } from './classifier.js';
import { ModelRegistry } from './registry.js';
import { getProvider } from '../providers/index.js';
import { pino } from 'pino';

const logger = pino({ name: 'routing' });

// Maps each provider to the env var holding its API key. Note Google's is
// GOOGLE_AI_API_KEY (not GOOGLE_API_KEY), which a naive `${NAME}_API_KEY`
// derivation would get wrong.
const API_KEY_ENV: Record<ProviderName, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

export interface RoutingContext {
  message: string;
  history: ChatMessage[];
  userId?: string;
  conversationId?: string;
  preferredProvider?: ProviderName;
  preferredModel?: string;
  ragContext?: string;
}

export class RoutingEngine {
  private registry: ModelRegistry;
  private providerOrder: ProviderName[] = ['openrouter', 'anthropic', 'openai', 'google'];

  constructor() {
    this.registry = new ModelRegistry();
  }

  async execute(
    context: RoutingContext,
  ): Promise<{ chunks: AsyncGenerator<any, void, unknown>; decision: RouteDecision; usage?: UsageLog }> {
    const taskType = classifyRequest(context.message, context.history);
    logger.info({ taskType, userId: context.userId, provider: context.preferredProvider }, 'Classified task');

    const explicitSelection = Boolean(context.preferredProvider && context.preferredModel);

    let decision: RouteDecision;
    if (explicitSelection) {
      decision = {
        provider: context.preferredProvider!,
        model: context.preferredModel!,
        reasoning: 'User-selected provider/model',
      };
    } else {
      decision = this.registry.getBestModel(taskType);
      logger.info({ decision, taskType }, 'Routing decision');
    }

    const messages: ChatMessage[] = context.ragContext
      ? [
          { role: 'system', content: `Use the following context to answer the user's question:\n\n${context.ragContext}` },
          ...context.history,
          { role: 'user', content: context.message },
        ]
      : [
          ...context.history,
          { role: 'user', content: context.message },
        ];

    // The provider actually used isn't known until streaming begins — a
    // provider can fail and we fall through to the next. Return a mutable
    // decision the generator updates on commit; chat.ts reads it *after*
    // draining the stream (for usage logging / cost), so it sees the final one.
    const finalDecision: RouteDecision = { ...decision };

    // Honor an explicit provider+model exactly — never silently fall back to a
    // different provider (which may not even support the requested model).
    // Otherwise try the routed provider first, then the rest in priority order.
    const candidates: ProviderName[] = explicitSelection
      ? [decision.provider]
      : [decision.provider, ...this.providerOrder.filter((p) => p !== decision.provider)];

    // decision.model is specific to the originally-routed provider; a fallback
    // provider must use one of its own models.
    const modelFor = (name: ProviderName): string =>
      name === decision.provider ? decision.model : getProvider(name).getCapabilities()[0]?.id ?? decision.model;

    const chunks = (async function* (): AsyncGenerator<StreamChunk, void, unknown> {
      let lastError = 'No providers configured';

      for (const name of candidates) {
        const envKey = API_KEY_ENV[name];
        const apiKey = envKey ? process.env[envKey] : undefined;
        if (!apiKey) {
          lastError = `No API key configured for ${name}`;
          continue;
        }

        const model = modelFor(name);
        // A provider only "commits" once it produces real text. Until then we
        // buffer non-text chunks (usage/done) so a provider that errors or
        // returns nothing can be abandoned cleanly for the next candidate
        // without leaking a premature usage/done downstream.
        let committed = false;
        const buffered: StreamChunk[] = [];

        try {
          const stream = getProvider(name).streamChat(messages, model, { apiKey, model, maxTokens: 4096 });
          for await (const chunk of stream) {
            if (chunk.type === 'error') {
              if (committed) {
                yield chunk;
                return;
              }
              lastError = chunk.error;
              break; // abandon this provider, try the next
            }

            if (committed) {
              yield chunk;
              continue;
            }

            if (chunk.type === 'text') {
              committed = true;
              finalDecision.provider = name;
              finalDecision.model = model;
              finalDecision.reasoning =
                name === decision.provider
                  ? decision.reasoning
                  : `Fell back to ${name} after ${decision.provider} was unavailable`;
              for (const b of buffered) yield b;
              buffered.length = 0;
              yield chunk;
            } else {
              buffered.push(chunk);
            }
          }

          if (committed) return; // finished successfully
          if (lastError === 'No providers configured') {
            lastError = `Provider ${name} returned no output`;
          }
        } catch (error: any) {
          if (committed) {
            yield { type: 'error', error: error?.message || 'Stream error' };
            return;
          }
          lastError = error?.message || `Provider ${name} failed`;
        }
      }

      yield { type: 'error', error: `All providers failed. Last error: ${lastError}` };
      yield { type: 'done' };
    })();

    return { chunks, decision: finalDecision };
  }

  createUsageLog(
    decision: RouteDecision,
    startTime: number,
    promptTokens: number,
    completionTokens: number,
    cost: number,
    userId: string,
    taskType: TaskType,
    conversationId?: string,
  ): UsageLog {
    return {
      userId,
      conversationId,
      provider: decision.provider,
      model: decision.model,
      tokensIn: promptTokens,
      tokensOut: completionTokens,
      cost,
      latencyMs: Date.now() - startTime,
      taskType,
    };
  }
}
