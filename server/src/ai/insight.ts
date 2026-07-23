import { RoutingEngine } from '../routing/engine.js';

const engine = new RoutingEngine();

// One-shot, non-streaming text generation used to power AI features outside the
// chat (Reports narrative, Home note, etc.). Returns null on any failure (no
// provider key, provider error) so callers can fall back to deterministic text.
export async function generateText(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const { chunks } = await engine.execute({
      message: userPrompt,
      history: [],
      systemPrompt,
      userId: undefined,
      conversationId: undefined,
      preferredProvider: undefined,
      preferredModel: undefined,
      ragContext: undefined,
    } as any);
    let text = '';
    for await (const chunk of chunks) {
      if (chunk.type === 'text') text += chunk.content || '';
      else if (chunk.type === 'error') return null;
    }
    const out = text.trim();
    return out.length ? out : null;
  } catch {
    return null;
  }
}
