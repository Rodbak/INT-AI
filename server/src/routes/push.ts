// Endpoints the phone uses to opt in / out of the daily briefing push, plus a
// test-send so the "turn on notifications" toggle can confirm it worked.
import { Router } from 'express';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { optionalAuth } from '../middleware/auth.js';
import { resolveWorkspaceId } from './coo.js';
import { pushEnabled, pushToWorkspace } from '../push/send.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();
router.use(optionalAuth);

// The public VAPID key the browser needs to create a subscription.
router.get('/key', (_req, res) => {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY || null, enabled: pushEnabled() });
});

// Save (or refresh) a device's subscription.
router.post('/subscribe', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const sub = req.body?.subscription || req.body;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'Invalid subscription' });
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { workspaceId: ws, p256dh, auth },
      create: { workspaceId: ws, endpoint, p256dh, auth },
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Could not save subscription' });
  }
});

router.post('/unsubscribe', async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (endpoint) await prisma.pushSubscription.delete({ where: { endpoint } }).catch(() => {});
  res.json({ ok: true });
});

// Fire a friendly test notification to this business's devices.
router.post('/test', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const r = await pushToWorkspace(ws, {
    title: 'INT is set up ✅',
    body: "You'll get a short summary of your business here every morning and evening.",
    url: '/home',
    tag: 'test',
  });
  res.json(r);
});

export default router;
