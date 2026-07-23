import type { ProviderName } from '../types.js';
import { prisma } from '../db.js';

const ALL_PROVIDERS: ProviderName[] = ['anthropic', 'openai', 'google', 'openrouter'];
const PROVIDER_KEY_ENV: Record<ProviderName, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

/** Providers whose API key is present in the environment (usable right now). */
export function availableProviders(): ProviderName[] {
  return ALL_PROVIDERS.filter((p) => Boolean(process.env[PROVIDER_KEY_ENV[p]]));
}

/**
 * Load the live roster (active specialists + defined teams) once per request.
 * Best-effort: a DB hiccup yields empty lists rather than blocking the turn.
 */
export async function loadPlatformRoster(): Promise<{
  specialists: { name: string; role: string }[];
  teams: { name: string; memberCount: number }[];
}> {
  try {
    const [specialists, teams] = await Promise.all([
      prisma.specialist.findMany({
        where: { active: true },
        select: { name: true, role: true },
        orderBy: { name: 'asc' },
        take: 24,
      }),
      prisma.team.findMany({
        select: { name: true, _count: { select: { members: true } } },
        orderBy: { name: 'asc' },
        take: 24,
      }),
    ]);
    return {
      specialists,
      teams: teams.map((t) => ({ name: t.name, memberCount: t._count.members })),
    };
  } catch {
    return { specialists: [], teams: [] };
  }
}

/**
 * INT AI's self-knowledge.
 *
 * Every conversation is grounded with a description of the platform the
 * assistant is running inside, so it can accurately explain what it is, how it
 * routes, and what it can do — rather than answering as a generic model that
 * has no idea it lives inside a "centralized nervous system" of providers,
 * specialists, and teams. The description is assembled from LIVE state
 * (configured providers, active specialists, defined teams) so the assistant's
 * self-account matches the actual running system instead of a stale blurb.
 */

export interface PlatformState {
  /** Providers that currently have an API key configured (usable right now). */
  availableProviders: ProviderName[];
  /** Active specialists the router can dispatch to. */
  specialists: { name: string; role: string }[];
  /** Defined multi-step teams. */
  teams: { name: string; memberCount: number }[];
  /** The specialist (if any) handling the current turn. */
  activeSpecialist?: { name: string; role: string } | null;
  /** When running inside a team pipeline, which team and where in it. */
  activeTeam?: { name: string; position: number; total: number } | null;
}

const PROVIDER_LABELS: Record<ProviderName, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT / o-series)',
  google: 'Google (Gemini)',
  openrouter: 'OpenRouter (aggregated access to many models)',
};

function bullet(lines: string[]): string {
  return lines.map((l) => `- ${l}`).join('\n');
}

/**
 * Build the platform-identity system prompt. Returned as a single string meant
 * to be the FIRST system part, ahead of any specialist persona and RAG context.
 */
export function buildPlatformIdentity(_state: PlatformState): string {
  // INT is the shop owner's warm, sharp AI business partner (an "AI COO") for a
  // small business in Ghana. This persona shapes every reply.
  return [
    `# Who you are`,
    `You are **INT** — the owner's personal AI business partner, like a smart, trusted friend who also happens to be an experienced Chief Operating Officer for their shop. You're on their side, always.`,
    ``,
    `# How you talk`,
    bullet([
      `**Warm and human first.** Greet the owner kindly, by their shop's name when you know it. Sound like a real person who cares — not a report or a robot.`,
      `**Encouraging.** Celebrate the wins ("Nice — sales are up this week! 🎉"). When things are tough, be kind and reassuring, then help them find a way forward. Never scold.`,
      `**Plain and short.** The owner is busy and may not be comfortable with big English or business jargon. Use simple words and short sentences. A few lines is usually enough.`,
      `**Money is Ghana cedis (GH₵).** You understand mobile money (MoMo), buying on credit, market days, restocking, suppliers, and the daily reality of running a shop here.`,
      `**Always end with a helpful next step** — one clear, doable suggestion, framed as friendly advice ("If I were you, I'd send Kofi a quick reminder today").`,
      `**Honest and trustworthy.** Answer from the real figures you're given. Never make up numbers — if you don't have something, say so warmly and tell them where to add it. It's fine to add a light, natural touch of emoji, but don't overdo it.`,
    ]),
    ``,
    `You are not a generic chatbot and you don't talk about AI models, routing, or technology unless asked. You are INT, the owner's partner — talk about their business, their money, and their next move.`,
  ].join('\n');
}
