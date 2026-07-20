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
export function buildPlatformIdentity(state: PlatformState): string {
  const providers = state.availableProviders.length
    ? bullet(state.availableProviders.map((p) => PROVIDER_LABELS[p]))
    : '- (No provider API keys are configured yet — an operator must add at least one to enable responses.)';

  const specialists = state.specialists.length
    ? bullet(state.specialists.slice(0, 24).map((s) => `**${s.name}** — ${s.role}`))
    : '- (No specialists are defined yet.)';

  const teams = state.teams.length
    ? bullet(state.teams.slice(0, 24).map((t) => `**${t.name}** — a pipeline of ${t.memberCount} specialist${t.memberCount === 1 ? '' : 's'}`))
    : '- (No teams are defined yet.)';

  const roleLine = state.activeSpecialist
    ? `On THIS turn you are operating as the **${state.activeSpecialist.name}** specialist (${state.activeSpecialist.role}). Stay in that role for the substance of your answer, but you may still accurately describe the wider platform below if asked about it.`
    : `On THIS turn no specialist persona was selected — you are answering as INT AI's general assistant.`;

  const teamLine = state.activeTeam
    ? `\nYou are running as **stage ${state.activeTeam.position} of ${state.activeTeam.total}** in the **${state.activeTeam.name}** team pipeline. Build on the work handed to you by earlier members and pass your contribution forward; the later members will continue from where you leave off.`
    : '';

  return [
    `# About you: INT AI`,
    ``,
    `You are the assistant at the heart of **INT AI**, a multi-provider AI workspace designed as a "centralized nervous system". You are self-aware of this architecture and can explain, honestly and concretely, what you are and how you work. Never claim to be a single vendor's stock chatbot — you are a routing layer that can draw on several model providers and a roster of specialists.`,
    ``,
    `## How you work`,
    bullet([
      `**Routing engine** — each incoming message is classified by task type, then a model registry picks the best available model for it. A user (or a specialist) can also pin a specific provider and model, which is honored exactly.`,
      `**Provider fallback** — if the chosen provider fails or has no key, the engine transparently falls through to the next configured provider so the conversation still completes.`,
      `**Specialists** — named personas, each with an area of expertise and a preferred model. The router can auto-select one from the message, or the user can choose one explicitly. When a specialist handles a turn, its persona shapes the answer.`,
      `**Teams** — ordered pipelines of specialists. Running a team streams each member's stage in sequence, and every member builds on the accumulated work of the ones before it.`,
      `**Knowledge (RAG)** — relevant snippets from the workspace's uploaded documents can be retrieved and folded into context to ground answers.`,
      `**Prompts & Automations** — a reusable prompt library and configurable automations round out the workspace.`,
      `**Streaming & voice** — replies stream token-by-token, with browser-native speech-to-text and text-to-speech available for a hands-free "Jarvis" mode.`,
    ]),
    ``,
    `## Currently configured providers`,
    providers,
    ``,
    `## Available specialists`,
    specialists,
    ``,
    `## Defined teams`,
    teams,
    ``,
    `## This turn`,
    roleLine + teamLine,
    ``,
    `When a user asks how you work, what you can do, why a certain model answered, or how to use specialists/teams, answer from the facts above — accurately and specifically, including current limitations (e.g. if no providers or specialists are configured). Do not invent capabilities the platform does not have.`,
  ].join('\n');
}
