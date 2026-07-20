// The "central nervous system" activity bus. Any part of the app can fire
// neurons or send signals along synapses; the NeuralField canvas reads this
// object every animation frame and renders it. Kept as a plain singleton (not
// React state) so 60fps canvas reads never trigger re-renders.

export type Hue = 'accent' | 'synapse';

export interface TravelingSignal {
  from: string;
  to: string;
  start: number; // performance.now() when it launched
  duration: number;
  hue: Hue;
}

class NeuralBus {
  /** Overall arousal 0..1, eased toward `target` by the canvas each frame. */
  intensity = 0;
  target = 0;
  /** node id -> performance.now() of its last fire, and the strength of it. */
  fires = new Map<string, { at: number; strength: number }>();
  /** active signals traveling along edges; the canvas prunes finished ones. */
  signals: TravelingSignal[] = [];

  private holdUntil = 0;

  /** Flash a node (a neuron firing). strength 0..1+. */
  fire(id: string, strength = 1) {
    this.fires.set(id, { at: performance.now(), strength });
  }

  /** Launch a signal traveling from one node to another. */
  signal(from: string, to: string, hue: Hue = 'accent', duration = 620) {
    this.signals.push({ from, to, start: performance.now(), duration, hue });
    // Cap the backlog so a runaway can't grow unbounded.
    if (this.signals.length > 120) this.signals.splice(0, this.signals.length - 120);
  }

  /** Raise overall arousal; optionally hold it there for `holdMs`. */
  arouse(level = 1, holdMs = 0) {
    this.target = Math.max(this.target, Math.min(level, 1));
    if (holdMs) this.holdUntil = Math.max(this.holdUntil, performance.now() + holdMs);
  }

  /** Let arousal decay back toward calm. */
  calm() {
    this.holdUntil = 0;
    this.target = 0;
  }

  /** Called by the canvas each frame to ease intensity toward target. */
  tick(now: number) {
    if (now < this.holdUntil) this.target = Math.max(this.target, 0.85);
    const k = this.intensity < this.target ? 0.08 : 0.03; // attack fast, release slow
    this.intensity += (this.target - this.intensity) * k;
    if (this.intensity < 0.001) this.intensity = 0;
  }
}

export const neural = new NeuralBus();

// Expose for quick manual tinkering / visual verification in dev only.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { neural: NeuralBus }).neural = neural;
}

// ---- Semantic helpers so callers don't hand-craft node ids ----

export const CORE = 'core';
export const providerNode = (name: string) => `provider:${name}`;
export const specialistNode = (idOrName: string) => `specialist:${idOrName}`;

/** A model id (e.g. "anthropic/claude-sonnet-4" or "gpt-4o") -> provider name. */
export function providerOfModel(model?: string): string {
  if (!model) return 'anthropic';
  if (model.startsWith('anthropic/') || model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('openai/') || model.startsWith('gpt') || model.startsWith('o3')) return 'openai';
  if (model.startsWith('google/') || model.startsWith('gemini')) return 'google';
  if (model.includes('/')) return 'openrouter';
  return 'anthropic';
}

/** Fire the core + the relevant provider and stream a signal between them. */
export function pulseThinking(model?: string) {
  const provider = providerOfModel(model);
  neural.arouse(1, 1200);
  neural.fire(CORE, 1);
  neural.fire(providerNode(provider), 1);
  neural.signal(CORE, providerNode(provider), 'accent');
}

/** Keep the system hot while tokens stream in. */
export function pulseStreaming(model?: string) {
  const provider = providerOfModel(model);
  neural.arouse(1, 900);
  if (Math.random() < 0.5) neural.signal(providerNode(provider), CORE, 'synapse', 480);
}
