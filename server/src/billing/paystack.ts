import { env } from '../env.js';

const BASE = 'https://api.paystack.co';

export function paystackConfigured(): boolean {
  return Boolean(env.PAYSTACK_SECRET_KEY);
}

/** Start a payment — returns the checkout URL to send the shop owner to. */
export async function initTransaction(input: { email: string; amountCedis: number; reference: string; callbackUrl?: string }): Promise<{ authorizationUrl: string } | null> {
  if (!paystackConfigured()) return null;
  const resp = await fetch(`${BASE}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountCedis * 100), // Paystack uses the minor unit (pesewas)
      currency: 'GHS',
      reference: input.reference,
      callback_url: input.callbackUrl,
    }),
  });
  if (!resp.ok) return null;
  const json: any = await resp.json();
  const url = json?.data?.authorization_url;
  return url ? { authorizationUrl: String(url) } : null;
}

/** Verify a payment reference — returns the amount paid (in cedis) if successful. */
export async function verifyTransaction(reference: string): Promise<{ amountCedis: number } | null> {
  if (!paystackConfigured()) return null;
  const resp = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
  });
  if (!resp.ok) return null;
  const json: any = await resp.json();
  if (json?.data?.status !== 'success') return null;
  return { amountCedis: (Number(json.data.amount) || 0) / 100 };
}
