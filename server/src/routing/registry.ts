import { AnthropicProvider } from '../providers/anthropic.js';
import { OpenAIProvider } from '../providers/openai.js';
import { GoogleProvider } from '../providers/google.js';
import { OpenRouterProvider } from '../providers/openrouter.js';
import type { ModelCapability, ProviderName, RouteDecision, TaskType } from '../types.js';

export interface RoutingPreferences {
  userId?: string;
  preferredProviders?: ProviderName[];
  maxCostPer1kTokens?: number;
  maxLatencyMs?: number;
  minQualityScore?: number;
}

export class ModelRegistry {
  private capabilities: ModelCapability[] = [];

  constructor() {
    this.loadCapabilities();
  }

  private loadCapabilities(): void {
    const providers = [
      new AnthropicProvider('', { apiKey: '', model: '', maxTokens: 0 }),
      new OpenAIProvider('', { apiKey: '', model: '', maxTokens: 0 }),
      new OpenRouterProvider('', { apiKey: '', model: '', maxTokens: 0 }),
      new GoogleProvider('', { apiKey: '', model: '', maxTokens: 0 }),
    ];

    this.capabilities = providers.flatMap((p) => p.getCapabilities());
  }

  getCapabilities(): ModelCapability[] {
    return this.capabilities;
  }

  getBestModel(
    taskType: TaskType,
    preferences: RoutingPreferences = {},
  ): RouteDecision {
    let candidates = this.capabilities.filter((c) => c.taskTypes.includes(taskType));

    if (preferences.preferredProviders && preferences.preferredProviders.length > 0) {
      candidates = candidates.filter((c) =>
        preferences.preferredProviders!.includes(c.provider),
      );
    }

    if (preferences.maxCostPer1kTokens) {
      const maxCost = preferences.maxCostPer1kTokens;
      candidates = candidates.filter(
        (c) => c.inputPricePerMillion / 1000 <= maxCost || c.outputPricePerMillion / 1000 <= maxCost,
      );
    }

    if (preferences.maxLatencyMs) {
      candidates = candidates.filter((c) => c.latencyMs <= preferences.maxLatencyMs!);
    }

    if (preferences.minQualityScore) {
      candidates = candidates.filter((c) => c.qualityScore >= preferences.minQualityScore!);
    }

    if (candidates.length === 0) {
      candidates = this.capabilities.filter((c) => c.taskTypes.includes(taskType));
    }

    const sorted = candidates.sort((a, b) => {
      const scoreA = a.qualityScore * 0.6 + (1 - a.inputPricePerMillion / 1000) * 0.3 + (1 - a.latencyMs / 5000) * 0.1;
      const scoreB = b.qualityScore * 0.6 + (1 - b.inputPricePerMillion / 1000) * 0.3 + (1 - b.latencyMs / 5000) * 0.1;
      return scoreB - scoreA;
    });

    const best = sorted[0];
    return {
      provider: best.provider,
      model: best.name,
      reasoning: `Selected ${best.displayName} (quality: ${best.qualityScore}, cost: $${best.inputPricePerMillion}/1M in)`,
    };
  }
}
