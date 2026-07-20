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

// Known-good OpenRouter slugs by native provider family (these match the
// OpenRouterProvider's advertised capabilities). Used to re-route a
// specialist's pinned model through OpenRouter when its native provider has no
// key configured, so a team/specialist still runs on an OpenRouter-only setup.
const OPENROUTER_EQUIVALENT: Record<ProviderName, string> = {
  anthropic: 'anthropic/claude-sonnet-4',
  openai: 'openai/gpt-4o',
  google: 'google/gemini-2.0-flash-001',
  openrouter: 'anthropic/claude-sonnet-4',
};

/**
 * Resolve a specialist's preferred model to a provider/model pair that can
 * actually run given which providers have API keys.
 *
 * - If the model's native provider is configured, use it as-is.
 * - Otherwise, if OpenRouter is configured, run it through OpenRouter: keep the
 *   model if it's already an OpenRouter slug, else map it to the closest
 *   known-good slug for its family (overridable via OPENROUTER_MODEL for
 *   unmapped families).
 * - If neither is available, return the native pair and let the engine surface
 *   the "no key" error honestly.
 *
 * This applies only to specialist-pinned models (a system convenience), never
 * to a user's explicit model-dropdown choice, which must be honored exactly.
 */
export function resolveModelForProviders(
  model: string,
  available: ProviderName[],
): { provider: ProviderName; model: string } {
  const native = providerForModel(model);
  if (available.includes(native)) return { provider: native, model };
  if (available.includes('openrouter')) {
    const orModel = model.includes('/')
      ? model
      : process.env.OPENROUTER_MODEL || OPENROUTER_EQUIVALENT[native];
    return { provider: 'openrouter', model: orModel };
  }
  return { provider: native, model };
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
