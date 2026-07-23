// Customer trust score — how reliably each customer pays back credit. Computed
// purely from their invoice + payment history so INT can warn the owner before
// they extend risky credit. No LLM, no guessing beyond the records.
import { prisma } from '../db.js';

const DAY = 86400000;

export type TrustBand = 'new' | 'reliable' | 'okay' | 'risky';

export interface Trust {
  score: number; // 0–100
  band: TrustBand;
  label: string; // short chip text, e.g. "Reliable payer"
  reason: string; // one warm sentence explaining it
  creditSales: number; // how many times they took credit
  onTimeRate: number | null; // 0–1 across resolved credit sales
  avgDaysToPay: number | null; // over settled credit sales
  outstanding: number; // what they owe right now
  maxOverdueDays: number; // worst currently-overdue age
}

const round = (n: number) => Math.round(n);

function bandFor(score: number, creditSales: number): TrustBand {
  if (creditSales === 0) return 'new';
  if (score >= 75) return 'reliable';
  if (score >= 50) return 'okay';
  return 'risky';
}

function describe(t: Omit<Trust, 'label' | 'reason'>): { label: string; reason: string } {
  if (t.band === 'new') return { label: 'New', reason: 'No credit history yet — nothing to worry about, just no track record so far.' };
  const days = t.avgDaysToPay != null ? `${round(t.avgDaysToPay)} day${round(t.avgDaysToPay) === 1 ? '' : 's'}` : null;
  if (t.band === 'reliable') {
    return { label: 'Reliable payer', reason: days ? `Pays back well — usually within ${days}.` : 'Pays back reliably. Safe to give credit.' };
  }
  if (t.band === 'okay') {
    return { label: 'Usually pays', reason: days ? `Pays, but sometimes takes a while (about ${days}).` : 'Pays eventually. Fine for small credit.' };
  }
  // risky
  if (t.maxOverdueDays > 0 && t.outstanding > 0) {
    return { label: 'Slow to pay', reason: `Currently owes GH₵ ${round(t.outstanding).toLocaleString()}, ${t.maxOverdueDays} day${t.maxOverdueDays === 1 ? '' : 's'} overdue. Be careful giving more credit.` };
  }
  return { label: 'Slow to pay', reason: days ? `Often pays late (about ${days}). Give credit carefully.` : 'Has been slow to pay before. Give credit carefully.' };
}

/** Trust for every customer in the workspace, keyed by customer id. */
export async function computeTrust(workspaceId: string): Promise<Map<string, Trust>> {
  const now = Date.now();
  const invoices = await prisma.salesInvoice.findMany({
    where: { workspaceId },
    select: {
      customerId: true, amount: true, issuedAt: true, dueAt: true,
      payments: { select: { amount: true, receivedAt: true } },
    },
  });

  // Group invoices per customer.
  const byCustomer = new Map<string, typeof invoices>();
  for (const inv of invoices) {
    const list = byCustomer.get(inv.customerId) || [];
    list.push(inv);
    byCustomer.set(inv.customerId, list);
  }

  const result = new Map<string, Trust>();
  for (const [customerId, list] of byCustomer) {
    let creditSales = 0;
    let onTime = 0;
    let resolvedOrLate = 0; // denominator for on-time rate
    let outstanding = 0;
    let maxOverdueDays = 0;
    const payDurations: number[] = [];

    for (const inv of list) {
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      const out = Math.max(0, inv.amount - paid);
      const lastPaymentAt = inv.payments.length
        ? Math.max(...inv.payments.map((p) => new Date(p.receivedAt).getTime()))
        : null;
      const issued = new Date(inv.issuedAt).getTime();
      const due = new Date(inv.dueAt).getTime();

      // Treat as "credit" only if it wasn't effectively a same-day cash sale:
      // still owing, or took more than a day to clear.
      const tookTime = lastPaymentAt != null && lastPaymentAt - issued > DAY;
      const isCredit = out > 0.5 || tookTime;
      if (!isCredit) continue;
      creditSales++;

      if (out <= 0.5 && lastPaymentAt != null) {
        // Fully settled credit sale.
        payDurations.push((lastPaymentAt - issued) / DAY);
        resolvedOrLate++;
        if (lastPaymentAt <= due) onTime++;
      } else {
        // Still owing.
        outstanding += out;
        const overdue = Math.floor((now - due) / DAY);
        if (overdue > 0) { maxOverdueDays = Math.max(maxOverdueDays, overdue); resolvedOrLate++; }
        // not yet due → neutral, doesn't help or hurt
      }
    }

    const onTimeRate = resolvedOrLate > 0 ? onTime / resolvedOrLate : null;
    const avgDaysToPay = payDurations.length ? payDurations.reduce((a, b) => a + b, 0) / payDurations.length : null;

    let score: number;
    if (creditSales === 0) score = 65;
    else if (onTimeRate == null) score = 60; // took credit but nothing resolved yet
    else score = round(20 + onTimeRate * 70); // 20..90
    if (maxOverdueDays > 0) score -= Math.min(30, maxOverdueDays);
    score = Math.max(5, Math.min(98, score));

    const band = bandFor(score, creditSales);
    const partial: Omit<Trust, 'label' | 'reason'> = {
      score, band, creditSales, onTimeRate,
      avgDaysToPay: avgDaysToPay != null ? round(avgDaysToPay) : null,
      outstanding: round(outstanding), maxOverdueDays,
    };
    const { label, reason } = describe(partial);
    result.set(customerId, { ...partial, label, reason });
  }

  return result;
}
