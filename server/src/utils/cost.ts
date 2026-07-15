import type { ProviderName, TaskType } from '../types.js';

export function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function calculateCost(
  provider: ProviderName,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing: Record<ProviderName, { input: number; output: number }> = {
    anthropic: { input: 3.0, output: 15.0 },
    openai: { input: 2.5, output: 10.0 },
    google: { input: 1.25, output: 10.0 },
  };

  const prices = pricing[provider];
  if (!prices) return 0;

  return (promptTokens / 1_000_000) * prices.input + (completionTokens / 1_000_000) * prices.output;
}

export function estimateLatency(
  provider: ProviderName,
  model: string,
  promptTokens: number,
): number {
  const baseLatency: Record<ProviderName, number> = {
    anthropic: 800,
    openai: 700,
    google: 900,
  };

  const base = baseLatency[provider] || 800;
  const tokenFactor = promptTokens / 1000;
  return Math.round(base + tokenFactor * 50);
}

export function formatCost(cost: number): string {
  if (cost < 0.001) return '<$0.001';
  return `$${cost.toFixed(4)}`;
}

export function validateModelForProvider(provider: ProviderName, model: string): boolean {
  if (provider === 'anthropic') {
    return model.startsWith('claude');
  }
  if (provider === 'openai') {
    return model.startsWith('gpt') || model.startsWith('o');
  }
  if (provider === 'google') {
    return model.startsWith('gemini');
  }
  return false;
}
