// Scheduled jobs, triggered by Vercel Cron (see vercel.json). Guarded by
// CRON_SECRET: Vercel automatically sends it as `Authorization: Bearer <secret>`
// on cron requests, so no one else can trigger a blast of notifications.
import { Router } from 'express';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { pushBriefing, pushEnabled } from '../push/send.js';

const router = Router();

function authorized(req: import('express').Request): boolean {
  if (!env.CRON_SECRET) return false;
  const header = req.header('authorization') || '';
  const bearer = header.replace(/^Bearer\s+/i, '');
  const key = (req.query.key as string) || '';
  return bearer === env.CRON_SECRET || key === env.CRON_SECRET;
}

// GET /api/cron/briefing?slot=morning|evening — push the stand-up to every
// business's subscribed devices. Single-shop today, but loops all workspaces so
// it keeps working when INT is multi-tenant.
router.get('/briefing', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!pushEnabled()) return res.status(503).json({ error: 'Push not configured' });
  const slot = req.query.slot === 'evening' ? 'evening' : 'morning';

  const workspaces = await prisma.workspace.findMany({ select: { id: true } });
  let sent = 0;
  let removed = 0;
  for (const w of workspaces) {
    try {
      const r = await pushBriefing(w.id, slot);
      sent += r.sent;
      removed += r.removed;
    } catch {
      /* skip a failing workspace, keep going */
    }
  }
  res.json({ ok: true, slot, workspaces: workspaces.length, sent, removed });
});

export default router;
