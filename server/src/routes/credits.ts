import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { resolveWorkspaceId } from './coo.js';
import { billingEnabled, getBalance, applyCredits, history } from '../billing/wallet.js';
import { paystackConfigured, initTransaction, verifyTransaction } from '../billing/paystack.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

// Wallet summary: balance, whether billing/Paystack are live, price, history.
router.get('/summary', optionalAuth, async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ enabled: billingEnabled(), balance: 0, history: [] });
  const [balance, txns] = await Promise.all([getBalance(ws), history(ws, 30)]);
  res.json({
    enabled: billingEnabled(),
    paystackReady: paystackConfigured(),
    balance: Math.round(balance),
    creditsPerCedi: env.CREDITS_PER_CEDI,
    publicKey: env.PAYSTACK_PUBLIC_KEY || null,
    history: txns.map((t) => ({ id: t.id, type: t.type, amount: Math.round(t.amount), balanceAfter: Math.round(t.balanceAfter), note: t.note, createdAt: t.createdAt })),
  });
});

// Start a top-up: returns a Paystack checkout URL for the given cedi amount.
router.post('/topup', authenticate, async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  if (!paystackConfigured()) return res.status(503).json({ error: 'Payments are not set up yet.' });
  const amountCedis = Math.max(1, Math.round(Number(req.body?.amountCedis) || 0));
  const email = req.user?.email || 'owner@int.app';
  const reference = `int_${ws}_${randomBytes(6).toString('hex')}`;
  const origin = req.header('origin') || env.PUBLIC_BASE_URL || '';
  const init = await initTransaction({ email, amountCedis, reference, callbackUrl: `${origin}/settings?topup=${reference}` });
  if (!init) return res.status(502).json({ error: 'Could not start the payment. Try again.' });
  res.json({ authorizationUrl: init.authorizationUrl, reference });
});

// Idempotently credit a verified reference to its workspace (encoded in the ref).
async function creditReference(reference: string): Promise<{ balance: number; credited: number } | null> {
  const ws = reference.split('_')[1];
  if (!ws) return null;
  const existing = await prisma.creditTransaction.findFirst({ where: { workspaceId: ws, reference, type: 'topup' } });
  if (existing) return { balance: Math.round(await getBalance(ws)), credited: 0 };
  const v = await verifyTransaction(reference);
  if (!v) return null;
  const credits = v.amountCedis * env.CREDITS_PER_CEDI;
  const balance = await applyCredits(ws, credits, 'topup', { reference, note: `Top-up GH₵ ${v.amountCedis.toLocaleString()}` });
  return { balance: Math.round(balance), credited: Math.round(credits) };
}

// Called when the owner returns from Paystack — confirm + credit the wallet.
router.get('/verify', optionalAuth, async (req, res) => {
  const reference = String(req.query.reference || '');
  if (!reference) return res.status(400).json({ error: 'Missing reference' });
  const result = await creditReference(reference).catch(() => null);
  if (!result) return res.status(400).json({ ok: false, error: 'Payment not confirmed yet.' });
  res.json({ ok: true, ...result });
});

// Paystack server-to-server webhook (charge.success). We re-verify via the API
// (no raw-body signature needed) and credit idempotently.
router.post('/paystack/webhook', async (req, res) => {
  const reference = req.body?.data?.reference;
  if (reference) await creditReference(String(reference)).catch(() => {});
  res.json({ received: true });
});

export default router;
