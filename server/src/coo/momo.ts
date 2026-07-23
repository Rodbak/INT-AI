// Parse a Ghanaian MoMo / bank SMS (MTN, Telecel/Vodafone, AirtelTigo, or a bank
// alert) into structured money movement so INT can propose the right record.
// Deterministic first; routes/coo.ts adds an LLM fallback only when this is unsure.

export interface ParsedMoney {
  direction: 'in' | 'out' | 'unknown';
  amount: number | null;
  counterparty: string | null; // the other party's name, if the message gives one
  phone: string | null;
  reference: string | null;
  category: string | null; // suggested expense category when money is going out
}

const IN_HINTS = ['received', 'credited', 'you have received', 'payment received', 'has credited', 'cash in'];
const OUT_HINTS = ['sent', 'transferred', 'paid to', 'payment to', 'payment made', 'made to', 'cash out', 'debited', 'purchased', 'bought', 'withdrawn', 'you have paid', 'payment of'];

export function parseAmount(text: string): number | null {
  // Prefer an amount attached to a cedi marker; fall back to a decimal figure.
  const m =
    text.match(/(?:GH[S₵¢c]|GHS|₵|cedis?)\s*([\d,]+(?:\.\d+)?)/i) ||
    text.match(/\b([\d,]+\.\d{2})\b/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function detectDirection(lower: string): 'in' | 'out' | 'unknown' {
  const hasIn = IN_HINTS.some((w) => lower.includes(w));
  const hasOut = OUT_HINTS.some((w) => lower.includes(w));
  if (hasIn && !hasOut) return 'in';
  if (hasOut && !hasIn) return 'out';
  // Both or neither: lean on the most decisive single words.
  if (/\breceived\b|\bcredited\b/.test(lower)) return 'in';
  if (/\bdebited\b|\bsent\b|\btransferred\b|\bpaid\b|\bcash out\b|\bwithdrawn\b/.test(lower)) return 'out';
  return 'unknown';
}

function extractName(text: string, direction: 'in' | 'out' | 'unknown'): string | null {
  const key = direction === 'out' ? 'to' : 'from';
  const re = new RegExp(`\\b${key}\\s+([A-Za-z][A-Za-z .'\\-]{1,40}?)(?=\\s*(?:\\(|,|\\.|\\d|\\bGH|\\bcedi|\\bon\\b|\\bfor\\b|\\bref|\\bcurrent\\b|\\bnew balance\\b|$))`, 'i');
  const m = text.match(re);
  if (!m) return null;
  const name = m[1].replace(/\s+/g, ' ').replace(/[.,]+$/, '').trim();
  return name.length > 1 ? name : null;
}

function extractPhone(text: string): string | null {
  const m = text.match(/\b(?:233|0)\d{9}\b/);
  return m ? m[0] : null;
}

function extractReference(text: string): string | null {
  const m = text.match(/(?:Ref(?:erence)?|Transaction\s*ID|Txn\s*ID|Financial\s*Transaction\s*Id)[:.\s]*([A-Za-z0-9.\-]{4,})/i);
  return m ? m[1].replace(/[.,]+$/, '') : null;
}

const CATEGORY_RULES: [RegExp, string][] = [
  [/airtime|data\b|bundle/i, 'Airtime / data'],
  [/electricity|ecg|prepaid|water|ghana water|utility/i, 'Utilities (light, water)'],
  [/\brent\b|landlord/i, 'Rent'],
  [/transport|trotro|uber|bolt|fuel|petrol|fare/i, 'Transport'],
  [/salary|wages|allowance|worker/i, 'Salaries'],
  [/stock|goods|supplier|wholesale|restock/i, 'Restock / buying stock'],
];

export function guessCategory(text: string): string | null {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(text)) return cat;
  return null;
}

export function parseMoneyMessage(text: string): ParsedMoney {
  const lower = text.toLowerCase();
  const direction = detectDirection(lower);
  return {
    direction,
    amount: parseAmount(text),
    counterparty: extractName(text, direction),
    phone: extractPhone(text),
    reference: extractReference(text),
    category: direction === 'out' ? guessCategory(text) : null,
  };
}
