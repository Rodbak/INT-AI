import type { ChatMessage, ProviderName, RouteDecision, TaskType, UsageLog } from '../types.js';
import { classifyRequest } from './classifier.js';
import { ModelRegistry } from './registry.js';
import { getProvider } from '../providers/index.js';
import { pino } from 'pino';

const logger = pino({ name: 'routing' });

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

    let decision: RouteDecision;

    if (context.preferredProvider && context.preferredModel) {
      decision = {
        provider: context.preferredProvider,
        model: context.preferredModel,
        reasoning: 'User-selected provider/model',
      };
    } else {
      decision = this.registry.getBestModel(taskType);
      logger.info({ decision, taskType }, 'Routing decision');
    }

    const provider = getProvider(decision.provider);
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

    const startTime = Date.now();

    let lastError: string | undefined;
    let chunks: AsyncGenerator<any, void, unknown> = (async function* () {
      yield { type: 'error', error: 'No providers configured' };
      yield { type: 'done' };
    })();
    let finalDecision = decision;

    for (const fallbackProvider of [decision.provider, ...this.providerOrder.filter((p) => p !== decision.provider)]) {
      try {
        const fallbackDecision: RouteDecision = {
          provider: fallbackProvider,
          model: decision.model,
          reasoning: fallbackProvider === decision.provider ? decision.reasoning : `Fallback to ${fallbackProvider}`,
        };

        const fallbackProviderImpl = getProvider(fallbackProvider);
        const fallbackKey = process.env[`${fallbackProvider.toUpperCase()}_API_KEY`];

        if (!fallbackKey) {
          lastError = `No API key configured for ${fallbackProvider}`;
          continue;
        }

        chunks = fallbackProviderImpl.streamChat(messages, fallbackDecision.model, {
          apiKey: fallbackKey,
          model: fallbackDecision.model,
          maxTokens: 4096,
        });

        finalDecision = fallbackDecision;
        lastError = undefined;
        break;
      } catch (error: any) {
        lastError = error.message || `Provider ${fallbackProvider} failed`;
        continue;
      }
    }

    if (lastError) {
      chunks = (async function* () {
        yield { type: 'error', error: `All providers failed. Last error: ${lastError}` };
        yield { type: 'done' };
      })();
    }

    return {
      chunks,
      decision: finalDecision,
    };
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
