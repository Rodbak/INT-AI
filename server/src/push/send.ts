// Web-push plumbing: configure VAPID from env, and send a notification to every
// device subscribed for a workspace. Stale subscriptions (410/404) are pruned.
import webpush from 'web-push';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { computeBriefing } from '../coo/signals.js';

let configured = false;

/** True only when a VAPID keypair is set — callers can skip push entirely. */
export function pushEnabled(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

function ensureConfigured() {
  if (configured || !pushEnabled()) return;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // where to go when tapped
  tag?: string; // collapses repeats
}

/** Send one payload to all of a workspace's subscribed devices. */
export async function pushToWorkspace(workspaceId: string, payload: PushPayload): Promise<{ sent: number; removed: number }> {
  if (!pushEnabled()) return { sent: 0, removed: 0 };
  ensureConfigured();

  const subs = await prisma.pushSubscription.findMany({ where: { workspaceId } });
  let sent = 0;
  let removed = 0;
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent++;
      } catch (err: any) {
        // 404/410 mean the subscription is dead — remove it so we stop trying.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { endpoint: s.endpoint } }).catch(() => {});
          removed++;
        }
      }
    }),
  );
  return { sent, removed };
}

/** Compose and send the daily briefing as a push notification. */
export async function pushBriefing(workspaceId: string, slot: 'morning' | 'evening'): Promise<{ sent: number; removed: number }> {
  const b = await computeBriefing(workspaceId, slot);
  const money = (n: number) => `GH₵ ${Math.round(n).toLocaleString()}`;
  const body =
    slot === 'morning'
      ? `Yesterday: ${money(b.yesterday.sales)} from ${b.yesterday.count} sale${b.yesterday.count === 1 ? '' : 's'}. Cash: ${money(b.cashOnHand)}. ${b.focus[0] ? 'Focus: ' + b.focus[0] : ''}`.trim()
      : `Today: ${money(b.today.sales)} from ${b.today.count} sale${b.today.count === 1 ? '' : 's'}. Cash: ${money(b.cashOnHand)}. ${b.watch ? 'Watch: ' + b.watch : 'Good work today.'}`.trim();
  return pushToWorkspace(workspaceId, { title: b.title, body, url: '/home', tag: `briefing-${slot}` });
}
