import type { ProviderName } from '../types.js';

export interface SpecialistLike {
  id: string;
  name: string;
  role: string;
  description: string;
  model: string;
  capabilities: unknown;
}

/** Map a model id to its provider (mirrors providers/index.ts naming). */
export function providerForModel(model: string): ProviderName {
  if (model.startsWith('anthropic/') || model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('openai/') || model.startsWith('gpt') || model.startsWith('o3')) return 'openai';
  if (model.startsWith('google/') || model.startsWith('gemini')) return 'google';
  if (model.includes('/')) return 'openrouter';
  return 'anthropic';
}

/** Turn a specialist row into a persona system prompt. */
export function buildSpecialistPrompt(s: SpecialistLike): string {
  const caps =
    Array.isArray(s.capabilities) && s.capabilities.length
      ? ` You are especially skilled at: ${(s.capabilities as string[]).join(', ')}.`
      : '';
  const desc = s.description ? ` ${s.description}` : '';
  return `You are ${s.name}, a specialist in ${s.role}.${desc}${caps} Stay in character and answer from your area of expertise.`;
}
