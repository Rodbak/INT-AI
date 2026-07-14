import type { ChatMessage, ProviderName, RouteDecision, TaskType, UsageLog } from '../types';
import { classifyRequest } from './classifier';
import { ModelRegistry } from './registry';
import { getProvider } from '../providers';
import { pino } from 'pino';

const logger = pino({ name: 'routing' });

export interface RoutingContext {
  message: string;
  history: ChatMessage[];
  userId?: string;
  conversationId?: string;
  preferredProvider?: ProviderName;
  preferredModel?: string;
}

export class RoutingEngine {
  private registry: ModelRegistry;

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
    const messages: ChatMessage[] = [
      ...context.history,
      { role: 'user', content: context.message },
    ];

    const startTime = Date.now();
    const chunks = provider.streamChat(messages, decision.model, {
      apiKey: process.env[`${decision.provider.toUpperCase()}_API_KEY`] || '',
      model: decision.model,
      maxTokens: 4096,
    });

    return {
      chunks,
      decision,
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
