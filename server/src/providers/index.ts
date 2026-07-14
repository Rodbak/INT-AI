import type { Provider, ProviderName } from '../types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GoogleProvider } from './google';

const providers: Record<ProviderName, Provider> = {
  anthropic: new AnthropicProvider(
    process.env.ANTHROPIC_API_KEY || '',
    { apiKey: process.env.ANTHROPIC_API_KEY || '', model: 'claude-sonnet-4-5-20250929', maxTokens: 4096 },
  ),
  openai: new OpenAIProvider(
    process.env.OPENAI_API_KEY || '',
    { apiKey: process.env.OPENAI_API_KEY || '', model: 'gpt-4o', maxTokens: 4096 },
  ),
  google: new GoogleProvider(
    process.env.GOOGLE_AI_API_KEY || '',
    { apiKey: process.env.GOOGLE_AI_API_KEY || '', model: 'gemini-2.0-flash', maxTokens: 4096 },
  ),
};

export function getProvider(name: ProviderName): Provider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}

export function getAllProviders(): Provider[] {
  return Object.values(providers);
}

export function getProviderNames(): ProviderName[] {
  return Object.keys(providers) as ProviderName[];
}
