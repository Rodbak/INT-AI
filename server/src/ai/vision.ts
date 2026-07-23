// Photo-to-inventory: send an image to a multimodal model on OpenRouter and get
// back a structured list of stock items the owner can confirm. Returns null on
// any failure so the caller can show a friendly "couldn't read that" message.
import { env } from '../env.js';

export interface StockItem { name: string; qty: number; unit?: string; price?: number | null }

// Configurable; defaults to a widely-available multimodal model on OpenRouter.
const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || 'anthropic/claude-3.5-sonnet';

export function visionAvailable(): boolean {
  return Boolean(env.OPENROUTER_API_KEY);
}

const PROMPT =
  `You are helping a small shop owner in Ghana take stock from a photo (a shelf, ` +
  `a delivery, or a supplier invoice). List every distinct product you can see. ` +
  `For each, give a short product name, the quantity (count the items; if you truly ` +
  `cannot tell, use 1), a unit if obvious (e.g. bottle, sachet, box, bag), and the ` +
  `price in Ghana cedis only if it is clearly printed (otherwise null). ` +
  `Reply with ONLY valid JSON, no prose, in exactly this shape: ` +
  `{"items":[{"name":"...","qty":1,"unit":"unit","price":null}]}`;

/** Pull the first JSON object out of a model reply and parse the items array. */
function parseItems(text: string): StockItem[] | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    const raw = Array.isArray(parsed?.items) ? parsed.items : [];
    const items: StockItem[] = raw
      .map((it: any) => ({
        name: String(it?.name || '').trim(),
        qty: Math.max(0, Math.round(Number(it?.qty) || 0)),
        unit: it?.unit ? String(it.unit).trim() : undefined,
        price: it?.price != null && Number(it.price) > 0 ? Number(it.price) : null,
      }))
      .filter((it: StockItem) => it.name.length > 0);
    return items;
  } catch {
    return null;
  }
}

export async function extractStockFromImage(imageDataUrl: string): Promise<StockItem[] | null> {
  if (!env.OPENROUTER_API_KEY) return null;
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'X-Title': 'INT',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0,
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) return null;
    const json: any = await resp.json();
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') return null;
    return parseItems(text);
  } catch {
    return null;
  }
}
