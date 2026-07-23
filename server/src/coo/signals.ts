// Proactive INT — turns the deterministic business snapshot into things INT
// should *say first*: short "nudge" cards for the Home feed, and a morning /
// evening briefing INT can push to the owner's phone. Everything here is
// computed from real records; the LLM (see routes/coo.ts) only ever rephrases
// this, it never invents the numbers.
import { prisma } from '../db.js';
import { computeBrief } from '../routes/coo.js';

const DAY = 86400000;

export type NudgeKind = 'low_stock' | 'debt' | 'cash' | 'win' | 'quiet';
export type Severity = 'urgent' | 'warning' | 'info' | 'good';

export interface NudgeAction {
  type: 'restock' | 'remind' | 'navigate';
  label: string;
  payload: Record<string, unknown>;
}

export interface Nudge {
  id: string; // stable per kind+entity so the UI can dedupe / remember dismissals
  kind: NudgeKind;
  severity: Severity;
  emoji: string;
  title: string;
  body: string;
  action?: NudgeAction;
}

const cedis = (n: number) => `GH₵ ${Math.round(n).toLocaleString()}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Ghana runs on GMT year-round (no daylight saving), so UTC day boundaries are
// also Accra day boundaries — no timezone maths needed.
function startOfTodayUTC(): number {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
}

/** Sales (invoiced value) grouped by day, for the last `days` days. */
async function dailySalesTotals(workspaceId: string, days: number): Promise<Map<string, number>> {
  const since = new Date(startOfTodayUTC() - (days - 1) * DAY);
  const invoices = await prisma.salesInvoice.findMany({
    where: { workspaceId, issuedAt: { gte: since } },
    select: { amount: true, issuedAt: true },
  });
  const map = new Map<string, number>();
  for (const inv of invoices) {
    const d = new Date(inv.issuedAt);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    map.set(key, (map.get(key) || 0) + inv.amount);
  }
  return map;
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

/**
 * The ranked list of things INT wants to raise, most pressing first. Pure
 * function of the records — safe to call anywhere (Home feed, briefing, cron).
 */
export async function computeNudges(workspaceId: string): Promise<Nudge[]> {
  const brief = await computeBrief(workspaceId);
  const nudges: Nudge[] = [];

  // ── Debts: chase the most overdue customer (receivables carry full detail) ──
  const debt = brief.receivables[0];
  if (debt && debt.outstanding > 0) {
    const overdue = debt.daysOverdue;
    nudges.push({
      id: `debt:${debt.invoiceId}`,
      kind: 'debt',
      severity: overdue >= 7 ? 'urgent' : 'warning',
      emoji: '💰',
      title: `${debt.customer} owes ${cedis(debt.outstanding)}`,
      body: overdue > 0
        ? `That's ${plural(overdue, 'day')} past due. Want INT to write a friendly reminder you can send on WhatsApp?`
        : `Still unpaid. Want INT to write a friendly reminder you can send on WhatsApp?`,
      action: {
        type: 'remind',
        label: 'Draft a reminder',
        payload: { customer: debt.customer, amount: Math.round(debt.outstanding), phone: debt.phone ?? null },
      },
    });
  }

  // ── Low stock: reorder the item closest to running out, sized to velocity ──
  const low = brief.lowStock[0];
  if (low) {
    const suggestedQty = Math.max(low.reorderPoint * 2 - low.stock, low.reorderPoint, 1);
    nudges.push({
      id: `low_stock:${low.id}`,
      kind: 'low_stock',
      severity: low.stock <= 0 ? 'urgent' : 'warning',
      emoji: '📦',
      title: low.stock <= 0 ? `${low.name} is finished` : `${low.name} is running low`,
      body: low.stock <= 0
        ? `You're out of ${low.name}. Want INT to draft a supplier message to reorder about ${plural(suggestedQty, low.unit)}?`
        : `Only ${plural(low.stock, low.unit)} left (you reorder at ${low.reorderPoint}). Want INT to draft a supplier message for about ${plural(suggestedQty, low.unit)}?`,
      action: {
        type: 'restock',
        label: 'Draft supplier message',
        payload: { productId: low.id, name: low.name, qty: suggestedQty, unit: low.unit },
      },
    });
  }

  // ── Cash runway: warn when the cushion is thin ──
  if (brief.cashRunwayWeeks != null && brief.cashRunwayWeeks <= 3) {
    nudges.push({
      id: 'cash:runway',
      kind: 'cash',
      severity: brief.cashRunwayWeeks <= 1.5 ? 'urgent' : 'warning',
      emoji: '⚠️',
      title: `Cash lasts about ${brief.cashRunwayWeeks} week${brief.cashRunwayWeeks === 1 ? '' : 's'}`,
      body: `At your recent spending, ${cedis(brief.cashOnHand)} won't stretch far. Chasing what you're owed (${cedis(brief.receivablesTotal)}) would help.`,
      action: { type: 'navigate', label: 'See the money', payload: { to: '/money' } },
    });
  }

  // ── Win: did the last full day beat the last month? Celebrate it ──
  const totals = await dailySalesTotals(workspaceId, 31);
  const yKey = dayKey(startOfTodayUTC() - DAY);
  const yesterday = totals.get(yKey) || 0;
  if (yesterday > 0) {
    let priorMax = 0;
    for (const [k, v] of totals) if (k !== yKey && k !== dayKey(startOfTodayUTC())) priorMax = Math.max(priorMax, v);
    if (yesterday >= priorMax && priorMax > 0) {
      nudges.push({
        id: `win:${yKey}`,
        kind: 'win',
        severity: 'good',
        emoji: '🎉',
        title: `Yesterday was your best day this month`,
        body: `You sold ${cedis(yesterday)} — your strongest day in weeks. Nice work. Keep whatever you did going.`,
      });
    }
  }

  const order: Record<Severity, number> = { urgent: 0, warning: 1, good: 2, info: 3 };
  return nudges.sort((a, b) => order[a.severity] - order[b.severity]);
}

export interface Briefing {
  slot: 'morning' | 'evening';
  title: string;
  yesterday: { sales: number; count: number };
  today: { sales: number; count: number };
  cashOnHand: number;
  focus: string[]; // short bullet lines
  watch: string | null;
}

/**
 * The stand-up INT gives the owner: what happened, what to focus on, one thing
 * to watch. `slot` shifts the framing (morning looks forward, evening looks
 * back) but the figures are the same real numbers either way.
 */
export async function computeBriefing(workspaceId: string, slot: 'morning' | 'evening' = 'morning'): Promise<Briefing> {
  const [brief, nudges] = await Promise.all([computeBrief(workspaceId), computeNudges(workspaceId)]);

  const todayStart = startOfTodayUTC();
  const yStart = todayStart - DAY;
  const [yInv, tInv] = await Promise.all([
    prisma.salesInvoice.findMany({ where: { workspaceId, issuedAt: { gte: new Date(yStart), lt: new Date(todayStart) } }, select: { amount: true } }),
    prisma.salesInvoice.findMany({ where: { workspaceId, issuedAt: { gte: new Date(todayStart) } }, select: { amount: true } }),
  ]);
  const yesterday = { sales: Math.round(yInv.reduce((s, i) => s + i.amount, 0)), count: yInv.length };
  const today = { sales: Math.round(tInv.reduce((s, i) => s + i.amount, 0)), count: tInv.length };

  // Focus = the two most pressing nudges, phrased tightly.
  const focus = nudges
    .filter((n) => n.kind !== 'win')
    .slice(0, 2)
    .map((n) => n.title);
  if (focus.length === 0) focus.push('Everything looks steady — keep serving customers.');

  // Watch = the single most urgent thing, if any.
  const urgent = nudges.find((n) => n.severity === 'urgent');
  const watch = urgent ? `${urgent.emoji} ${urgent.title}` : null;

  const title = slot === 'morning'
    ? 'Good morning — here’s your stand-up'
    : 'End of day — here’s how it went';

  return { slot, title, yesterday, today, cashOnHand: brief.cashOnHand, focus, watch };
}
