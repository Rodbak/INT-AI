import { Router } from 'express';
import { prisma } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { generateText } from '../ai/insight.js';
import { computeNudges, computeBriefing } from '../coo/signals.js';
import { computeTrust } from '../coo/trust.js';
import { extractStockFromImage, visionAvailable } from '../ai/vision.js';
import { parseMoneyMessage, guessCategory } from '../coo/momo.js';
import { authEnabled } from '../auth/verify.js';
import { meterAI } from '../billing/wallet.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();
router.use(optionalAuth);

const DAY = 86400000;

/** Resolve the business (workspace) for this request. Falls back to the demo
 *  workspace when unauthenticated (local dev), so the COO works out of the box. */
export async function resolveWorkspaceId(req: AuthenticatedRequest): Promise<string | null> {
  if (req.user?.id) {
    const m = await prisma.workspaceUser.findFirst({ where: { userId: req.user.id }, select: { workspaceId: true } });
    if (m) return m.workspaceId;
  }
  // With real auth on, never fall back to another shop's workspace (would leak
  // data across tenants). In demo mode, use the single shared workspace.
  if (authEnabled()) return null;
  const first = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  return first?.id ?? null;
}

/** The core business snapshot — computed deterministically from records. */
export async function computeBrief(workspaceId: string) {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY);
  const twoWeeksAgo = new Date(now - 14 * DAY);

  const [payAgg, expAgg, expList, invoices, products, items] = await Promise.all([
    prisma.payment.aggregate({ where: { workspaceId }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { workspaceId }, _sum: { amount: true } }),
    prisma.expense.findMany({ where: { workspaceId }, select: { amount: true, spentAt: true } }),
    prisma.salesInvoice.findMany({
      where: { workspaceId },
      select: {
        id: true, number: true, amount: true, status: true, issuedAt: true, dueAt: true,
        customer: { select: { id: true, name: true, phone: true } },
        payments: { select: { amount: true } },
      },
    }),
    prisma.product.findMany({ where: { workspaceId }, select: { id: true, name: true, cost: true, stock: true, reorderPoint: true, unit: true, price: true } }),
    prisma.salesInvoiceItem.findMany({
      where: { invoice: { workspaceId } },
      select: { qty: true, unitPrice: true, product: { select: { id: true, name: true, cost: true } } },
    }),
  ]);

  const cashOnHand = (payAgg._sum.amount || 0) - (expAgg._sum.amount || 0);

  // Receivables — outstanding per unpaid/partial invoice
  const receivables = invoices
    .filter((i) => i.status !== 'paid')
    .map((i) => {
      const paid = i.payments.reduce((s, p) => s + p.amount, 0);
      const outstanding = Math.max(0, i.amount - paid);
      const daysOverdue = Math.floor((now - new Date(i.dueAt).getTime()) / DAY);
      return { invoiceId: i.id, number: i.number, customer: i.customer.name, phone: i.customer.phone, outstanding, daysOverdue };
    })
    .filter((r) => r.outstanding > 0.5)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
  const receivablesTotal = receivables.reduce((s, r) => s + r.outstanding, 0);

  // Low stock
  const lowStock = products
    .filter((p) => p.stock <= p.reorderPoint)
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock, reorderPoint: p.reorderPoint, unit: p.unit, cost: p.cost }))
    .sort((a, b) => a.stock - b.stock);

  // Sales trend (invoiced value, this week vs last week)
  const salesThisWeek = invoices.filter((i) => new Date(i.issuedAt) >= weekAgo).reduce((s, i) => s + i.amount, 0);
  const salesPrevWeek = invoices
    .filter((i) => new Date(i.issuedAt) >= twoWeeksAgo && new Date(i.issuedAt) < weekAgo)
    .reduce((s, i) => s + i.amount, 0);
  const trendPct = salesPrevWeek > 0 ? Math.round(((salesThisWeek - salesPrevWeek) / salesPrevWeek) * 100) : null;

  // Best seller by revenue + margin
  const byProduct = new Map<string, { name: string; revenue: number; cost: number }>();
  for (const it of items) {
    const cur = byProduct.get(it.product.id) || { name: it.product.name, revenue: 0, cost: 0 };
    cur.revenue += it.qty * it.unitPrice;
    cur.cost += it.qty * it.product.cost;
    byProduct.set(it.product.id, cur);
  }
  const ranked = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue);
  const top = ranked[0];
  const bestSeller = top ? { name: top.name, revenue: Math.round(top.revenue), marginPct: top.revenue ? Math.round(((top.revenue - top.cost) / top.revenue) * 100) : 0 } : null;

  // Cash runway (weeks) from average weekly expense over last 30 days
  const recentExpense = expList.filter((e) => now - new Date(e.spentAt).getTime() <= 30 * DAY).reduce((s, e) => s + e.amount, 0);
  const weeklyBurn = recentExpense > 0 ? recentExpense / (30 / 7) : 0;
  const cashRunwayWeeks = weeklyBurn > 0 ? Math.max(0, Math.round((cashOnHand / weeklyBurn) * 10) / 10) : null;

  return {
    cashOnHand: Math.round(cashOnHand),
    receivablesTotal: Math.round(receivablesTotal),
    receivablesCount: receivables.length,
    receivables: receivables.slice(0, 8),
    topDebtor: receivables[0] || null,
    lowStock,
    lowStockCount: lowStock.length,
    salesThisWeek: Math.round(salesThisWeek),
    salesPrevWeek: Math.round(salesPrevWeek),
    trendPct,
    bestSeller,
    cashRunwayWeeks,
  };
}

/** Suggested decision cards derived from the brief. */
function suggestActions(brief: Awaited<ReturnType<typeof computeBrief>>) {
  const cards: { kind: string; title: string; detail: string; cta: string; payload: any }[] = [];
  if (brief.topDebtor && brief.topDebtor.daysOverdue >= 0) {
    const d = brief.topDebtor;
    cards.push({
      kind: 'reminder',
      title: `Chase ${d.customer}'s GH₵ ${d.outstanding.toLocaleString()}`,
      detail: `${d.number} is ${d.daysOverdue} day${d.daysOverdue === 1 ? '' : 's'} overdue. Send a friendly WhatsApp reminder?`,
      cta: 'Send reminder',
      payload: { invoiceId: d.invoiceId, customer: d.customer, amount: d.outstanding },
    });
  }
  const low = brief.lowStock[0];
  if (low) {
    const qty = Math.max(low.reorderPoint * 2 - low.stock, low.reorderPoint);
    cards.push({
      kind: 'restock',
      title: `Restock ${low.name}`,
      detail: `Only ${low.stock} ${low.unit}${low.stock === 1 ? '' : 's'} left (reorder at ${low.reorderPoint}). Draft a purchase order for ${qty}?`,
      cta: 'Draft order',
      payload: { productId: low.id, name: low.name, qty, estCost: Math.round(qty * low.cost) },
    });
  }
  return cards;
}

/** Whether this business is brand-new (no data + hasn't finished the welcome
 *  flow). Used to decide whether to show first-run setup. */
async function getSetupStatus(workspaceId: string) {
  const [ws, products, sales, expenses, payments, done] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    prisma.product.count({ where: { workspaceId } }),
    prisma.salesInvoice.count({ where: { workspaceId } }),
    prisma.expense.count({ where: { workspaceId } }),
    prisma.payment.count({ where: { workspaceId } }),
    prisma.cooAction.count({ where: { workspaceId, kind: 'onboarding' } }),
  ]);
  const hasData = products + sales + expenses + payments > 0;
  const isDefaultName = !ws?.name || /^(my |default )?workspace$/i.test(ws.name.trim());
  const shopName = isDefaultName ? '' : (ws?.name ?? '');
  return { needsSetup: !hasData && done === 0, shopName };
}

router.get('/brief', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ empty: true });
  const brief = await computeBrief(ws);
  const actions = suggestActions(brief);
  const { shopName } = await getSetupStatus(ws);
  res.json({ ...brief, actions, currency: 'GH₵', shopName });
});

router.get('/setup', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ needsSetup: false, shopName: '' });
  res.json(await getSetupStatus(ws));
});

// Save the shop name and (optionally) starter products/customers in one go,
// then drop an onboarding marker so the welcome flow doesn't show again.
router.post('/setup', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const b = req.body || {};
  const shopName = String(b.shopName || '').trim();
  if (shopName) await prisma.workspace.update({ where: { id: ws }, data: { name: shopName } });

  const products: any[] = Array.isArray(b.products) ? b.products : [];
  for (const p of products) {
    const name = String(p?.name || '').trim();
    if (!name) continue;
    await prisma.product.create({
      data: {
        workspaceId: ws,
        name,
        price: num(p.price) || 0,
        cost: num(p.cost) || 0,
        stock: int(p.stock) || 0,
        reorderPoint: int(p.reorderPoint) || 0,
        unit: String(p.unit || 'unit').trim() || 'unit',
      },
    });
  }
  const customers: any[] = Array.isArray(b.customers) ? b.customers : [];
  for (const c of customers) {
    const name = String(c?.name || '').trim();
    if (!name) continue;
    await prisma.customer.create({ data: { workspaceId: ws, name, phone: String(c.phone || '').trim() || null } });
  }

  await prisma.cooAction.create({ data: { workspaceId: ws, kind: 'onboarding', title: 'Setup complete', status: 'done' } });
  res.status(201).json({ ok: true, shopName });
});

router.get('/receivables', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ receivables: [] });
  const brief = await computeBrief(ws);
  res.json({ receivables: brief.receivables, total: brief.receivablesTotal });
});

// Plain-language business report: money in vs out, profit, top customers /
// products, and which days of the week sell best.
router.get('/reports', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ empty: true });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sixtyAgo = new Date(now.getTime() - 60 * DAY);

  // The period the owner is looking at (defaults to this month).
  const range = ['7d', '30d', 'month', 'lastmonth', 'custom'].includes(String(req.query.range)) ? String(req.query.range) : 'month';
  let periodStart: Date;
  let periodEnd: Date | undefined;
  let prevStart: Date;
  let prevEnd: Date;
  let periodLabel: string;
  let compareLabel: string;
  if (range === 'custom') {
    const from = new Date(String(req.query.from || ''));
    const to = new Date(String(req.query.to || ''));
    const validTo = !isNaN(to.getTime());
    periodStart = isNaN(from.getTime()) ? new Date(now.getTime() - 30 * DAY) : from;
    periodEnd = validTo ? new Date(to.getTime() + DAY) : undefined; // include the whole "to" day
    const span = (periodEnd ? periodEnd.getTime() : now.getTime()) - periodStart.getTime();
    prevStart = new Date(periodStart.getTime() - span);
    prevEnd = periodStart;
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    periodLabel = `${fmt(periodStart)} – ${validTo ? fmt(to) : fmt(now)}`;
    compareLabel = 'the period before';
  } else if (range === '7d') {
    periodStart = new Date(now.getTime() - 7 * DAY); periodEnd = undefined;
    prevStart = new Date(now.getTime() - 14 * DAY); prevEnd = periodStart;
    periodLabel = 'the last 7 days'; compareLabel = 'the 7 days before';
  } else if (range === '30d') {
    periodStart = new Date(now.getTime() - 30 * DAY); periodEnd = undefined;
    prevStart = new Date(now.getTime() - 60 * DAY); prevEnd = periodStart;
    periodLabel = 'the last 30 days'; compareLabel = 'the 30 days before';
  } else if (range === 'lastmonth') {
    periodStart = lastMonthStart; periodEnd = monthStart;
    prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1); prevEnd = lastMonthStart;
    periodLabel = lastMonthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); compareLabel = 'the month before';
  } else {
    periodStart = monthStart; periodEnd = undefined;
    prevStart = lastMonthStart; prevEnd = monthStart;
    periodLabel = monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); compareLabel = 'last month';
  }

  const [payments, expenses, invoices, items] = await Promise.all([
    prisma.payment.findMany({ where: { workspaceId: ws }, select: { amount: true, receivedAt: true } }),
    prisma.expense.findMany({ where: { workspaceId: ws }, select: { amount: true, spentAt: true } }),
    prisma.salesInvoice.findMany({ where: { workspaceId: ws }, select: { amount: true, issuedAt: true, customer: { select: { name: true } } } }),
    prisma.salesInvoiceItem.findMany({
      where: { invoice: { workspaceId: ws } },
      select: { qty: true, unitPrice: true, invoice: { select: { issuedAt: true } }, product: { select: { name: true, cost: true } } },
    }),
  ]);

  const inRange = (d: Date, start: Date, end?: Date) => {
    const t = new Date(d).getTime();
    return t >= start.getTime() && (!end || t < end.getTime());
  };
  const sum = (arr: number[]) => arr.reduce((s, n) => s + n, 0);

  // Money in / out for a period.
  const periodStats = (start: Date, end?: Date) => {
    const moneyIn = sum(payments.filter((p) => inRange(p.receivedAt, start, end)).map((p) => p.amount));
    const moneyOut = sum(expenses.filter((e) => inRange(e.spentAt, start, end)).map((e) => e.amount));
    const sales = sum(invoices.filter((i) => inRange(i.issuedAt, start, end)).map((i) => i.amount));
    const profit = sum(
      items.filter((it) => inRange(it.invoice.issuedAt, start, end)).map((it) => it.qty * (it.unitPrice - it.product.cost)),
    );
    return { moneyIn: Math.round(moneyIn), moneyOut: Math.round(moneyOut), net: Math.round(moneyIn - moneyOut), sales: Math.round(sales), profit: Math.round(profit) };
  };
  const period = periodStats(periodStart, periodEnd);
  const previous = periodStats(prevStart, prevEnd);

  // Top customers in the period (by amount sold, excluding walk-ins).
  const custMap = new Map<string, number>();
  for (const i of invoices) {
    if (!inRange(i.issuedAt, periodStart, periodEnd) || i.customer.name === 'Walk-in customer') continue;
    custMap.set(i.customer.name, (custMap.get(i.customer.name) || 0) + i.amount);
  }
  const topCustomers = [...custMap.entries()].map(([name, total]) => ({ name, total: Math.round(total) })).sort((a, b) => b.total - a.total).slice(0, 5);

  // Top products in the period (by revenue), with profit.
  const prodMap = new Map<string, { revenue: number; profit: number }>();
  for (const it of items) {
    if (!inRange(it.invoice.issuedAt, periodStart, periodEnd)) continue;
    const cur = prodMap.get(it.product.name) || { revenue: 0, profit: 0 };
    cur.revenue += it.qty * it.unitPrice;
    cur.profit += it.qty * (it.unitPrice - it.product.cost);
    prodMap.set(it.product.name, cur);
  }
  const topProducts = [...prodMap.entries()].map(([name, v]) => ({ name, revenue: Math.round(v.revenue), profit: Math.round(v.profit) })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Sales by weekday over the last 60 days (Mon…Sun).
  const order = [1, 2, 3, 4, 5, 6, 0];
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const byDow = new Map<number, number>();
  for (const i of invoices) {
    if (!inRange(i.issuedAt, sixtyAgo)) continue;
    const dow = new Date(i.issuedAt).getDay();
    byDow.set(dow, (byDow.get(dow) || 0) + i.amount);
  }
  const weekday = order.map((d, idx) => ({ day: labels[idx], sales: Math.round(byDow.get(d) || 0) }));
  const busiest = [...weekday].sort((a, b) => b.sales - a.sales)[0];

  // Daily sales across the selected period (one bar per day, capped at 31).
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const endMs = (periodEnd ? periodEnd.getTime() : now.getTime());
  const days = Math.min(31, Math.max(1, Math.ceil((endMs - periodStart.getTime()) / DAY)));
  const dailyMap = new Map<string, number>();
  for (let k = days - 1; k >= 0; k--) dailyMap.set(dayKey(new Date(endMs - k * DAY)), 0);
  for (const i of invoices) {
    const key = dayKey(new Date(i.issuedAt));
    if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) || 0) + i.amount);
  }
  const dailySales = [...dailyMap.entries()].map(([date, sales]) => ({
    date,
    label: new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    sales: Math.round(sales),
  }));

  res.json({
    range,
    periodLabel,
    compareLabel,
    period,
    previous,
    topCustomers,
    topProducts,
    weekday,
    busiestDay: busiest && busiest.sales > 0 ? busiest.day : null,
    dailySales,
    currency: 'GH₵',
  });
});

// AI-written narrative + observations from the real figures (powers Reports and
// Home). Falls back to deterministic text when no model key is configured.
router.get('/insights', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ narrative: null, generated: false });
  const b = await computeBrief(ws);
  const workspace = await prisma.workspace.findUnique({ where: { id: ws }, select: { name: true } });
  const shop = workspace?.name && !/^(my |default )?workspace$/i.test(workspace.name) ? workspace.name : 'your shop';

  // Deterministic fallback so the card is never empty.
  const netUp = b.salesThisWeek >= b.salesPrevWeek;
  const fallback =
    `Cash on hand is GH₵ ${b.cashOnHand.toLocaleString()} and ${shop} made GH₵ ${b.salesThisWeek.toLocaleString()} this week` +
    `${b.trendPct != null ? ` (${b.trendPct >= 0 ? 'up' : 'down'} ${Math.abs(b.trendPct)}% vs last week)` : ''}. ` +
    (b.receivablesTotal > 0 ? `GH₵ ${b.receivablesTotal.toLocaleString()} is still owed to you by ${b.receivablesCount} customer${b.receivablesCount === 1 ? '' : 's'}. ` : `Everyone has paid up — nice. `) +
    (b.lowStock.length ? `Keep an eye on stock: ${b.lowStock.slice(0, 3).map((p) => p.name).join(', ')} running low.` : `Stock levels look healthy.`);

  const data =
    `Shop: ${shop}. Cash on hand: GH₵ ${b.cashOnHand}. Runway: ${b.cashRunwayWeeks ?? '—'} weeks. ` +
    `Sales this week: GH₵ ${b.salesThisWeek} (last week GH₵ ${b.salesPrevWeek}). ` +
    `Owed to you: GH₵ ${b.receivablesTotal} from ${b.receivablesCount} customers. ` +
    (b.bestSeller ? `Best seller: ${b.bestSeller.name} at ${b.bestSeller.marginPct}% margin. ` : '') +
    (b.lowStock.length ? `Low stock: ${b.lowStock.map((p) => `${p.name} (${p.stock})`).join(', ')}. ` : '');

  const system =
    `You are INT, the owner's warm AI business partner for a small shop in Ghana. ` +
    `Write a short, friendly note (2–3 sentences) about how the business is doing, based ONLY on the figures given. ` +
    `Be encouraging, plain, in Ghana cedis (GH₵), and end with one helpful suggestion. No lists, no headings — just a warm little paragraph. Never invent numbers.`;

  // Reuse a recent AI note instead of paying for a new one on every refresh.
  // The AI prose is cached per workspace for 2 hours; all the KPIs above are
  // still computed live — only this narrative is cached to cut token usage.
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const cached = await prisma.cooAction.findFirst({ where: { workspaceId: ws, kind: 'insight_cache' }, orderBy: { createdAt: 'desc' } }).catch(() => null);
  if (cached && Date.now() - new Date(cached.createdAt).getTime() < TWO_HOURS) {
    const payload = (cached.payload as any) || {};
    return res.json({ narrative: payload.narrative || fallback, generated: payload.generated ?? false, currency: 'GH₵', cached: true });
  }

  // Meter this AI generation; if out of credits, quietly use the deterministic
  // note so Home never breaks (no charge, no error).
  const allowed = await meterAI(ws, 'insight');
  const narrative = allowed ? ((await generateText(system, `Here are today's figures:\n${data}\n\nWrite the note.`)) || fallback) : fallback;
  const generated = narrative !== fallback;
  // Only cache real AI output, so a key-less fallback keeps retrying next time.
  if (generated) {
    await prisma.cooAction.deleteMany({ where: { workspaceId: ws, kind: 'insight_cache' } }).catch(() => {});
    await prisma.cooAction.create({ data: { workspaceId: ws, kind: 'insight_cache', title: 'insight', status: 'done', payload: { narrative, generated } } }).catch(() => {});
  }
  res.json({ narrative, generated, currency: 'GH₵' });
});

// Proactive feed: the short cards INT wants to raise, most pressing first.
router.get('/nudges', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ nudges: [] });
  try {
    res.json({ nudges: await computeNudges(ws), currency: 'GH₵' });
  } catch {
    res.json({ nudges: [] });
  }
});

// The morning / end-of-day stand-up (also what the push cron sends).
router.get('/briefing', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ empty: true });
  const slot = req.query.slot === 'evening' ? 'evening' : 'morning';
  const briefing = await computeBriefing(ws, slot);
  res.json({ ...briefing, currency: 'GH₵' });
});

// Draft a short, ready-to-send message for a proactive action (a WhatsApp
// reminder to a debtor, or a supplier restock request). INT writes it warmly;
// a deterministic template is used when no model key is set.
router.post('/draft', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  if (!(await meterAI(ws, 'draft message'))) return res.status(402).json({ error: 'You’re out of AI credits — top up in Settings to let INT write messages for you.' });
  const b = req.body || {};
  const purpose = String(b.purpose || '');
  const workspace = await prisma.workspace.findUnique({ where: { id: ws }, select: { name: true } });
  const shop = workspace?.name && !/^(my |default )?workspace$/i.test(workspace.name) ? workspace.name : 'my shop';

  if (purpose === 'reminder') {
    const customer = String(b.customer || 'there').trim();
    const amount = num(b.amount) || 0;
    const fallback = `Hello ${customer}, this is a gentle reminder from ${shop} that you have a balance of GH₵ ${amount.toLocaleString()}. Whenever you're able, you can pay by MoMo or cash. Thank you so much! 🙏`;
    const text = (await generateText(
      `You are INT, writing on behalf of a small Ghanaian shop owner. Write a SHORT, warm, respectful WhatsApp message reminding a customer of an unpaid balance. Never be harsh. Mention MoMo or cash. One short paragraph, in Ghana cedis. Output only the message text.`,
      `Shop: ${shop}. Customer: ${customer}. Balance owed: GH₵ ${amount}. Write the reminder.`,
    )) || fallback;
    return res.json({ text, generated: text !== fallback });
  }

  if (purpose === 'restock') {
    const name = String(b.name || 'stock').trim();
    const qty = int(b.qty) || 0;
    const unit = String(b.unit || 'unit').trim();
    const fallback = `Hello, this is ${shop}. Please I'd like to reorder ${qty} ${unit}${qty === 1 ? '' : 's'} of ${name}. Kindly let me know the price and when you can deliver. Thank you!`;
    const text = (await generateText(
      `You are INT, writing on behalf of a small Ghanaian shop owner to their supplier. Write a SHORT, polite WhatsApp message requesting a restock, asking for price and delivery time. One short paragraph. Output only the message text.`,
      `Shop: ${shop}. Item: ${name}. Quantity: ${qty} ${unit}. Write the supplier message.`,
    )) || fallback;
    return res.json({ text, generated: text !== fallback });
  }

  return res.status(400).json({ error: 'Unknown draft purpose' });
});

router.get('/inventory', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ products: [] });
  const products = await prisma.product.findMany({ where: { workspaceId: ws }, orderBy: { name: 'asc' } });
  res.json({ products: products.map((p) => ({ ...p, low: p.stock <= p.reorderPoint })) });
});

/** Approve a suggested action — records it and returns a done-state message. */
router.post('/actions', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const { kind, title, detail, payload } = req.body || {};
  if (!kind || !title) return res.status(400).json({ error: 'kind and title required' });
  const action = await prisma.cooAction.create({
    data: { workspaceId: ws, kind, title, detail: detail || null, payload: payload || undefined, status: 'approved' },
  });
  // Lightweight "execution" acknowledgements (real integrations come later).
  const done =
    kind === 'reminder'
      ? `Reminder queued for ${payload?.customer ?? 'the customer'}.`
      : kind === 'restock'
        ? `Purchase order drafted for ${payload?.qty ?? ''} × ${payload?.name ?? 'item'} (≈ GH₵ ${payload?.estCost ?? '—'}).`
        : 'Done.';
  res.status(201).json({ id: action.id, status: 'approved', message: done });
});

router.get('/actions', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ actions: [] });
  const actions = await prisma.cooAction.findMany({ where: { workspaceId: ws }, orderBy: { createdAt: 'desc' }, take: 20 });
  res.json({ actions });
});

// ─────────────────────────────────────────────────────────────────────────────
// Business management: customers, products, sales, payments, expenses.
// Everything below writes real records so the Home brief updates immediately.
// ─────────────────────────────────────────────────────────────────────────────

const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : parseFloat(String(v)));
const int = (v: unknown) => Math.round(num(v));

/** Next invoice number for a workspace, e.g. INV-1012. */
async function nextInvoiceNumber(workspaceId: string): Promise<string> {
  const count = await prisma.salesInvoice.count({ where: { workspaceId } });
  return `INV-${1000 + count + 1}`;
}

/** Find or create the "Walk-in" customer used for over-the-counter sales. */
async function walkInCustomer(workspaceId: string) {
  const existing = await prisma.customer.findFirst({ where: { workspaceId, name: 'Walk-in customer' } });
  if (existing) return existing;
  return prisma.customer.create({ data: { workspaceId, name: 'Walk-in customer' } });
}

/** Recompute an invoice's paid/partial/unpaid status from its payments. */
async function refreshInvoiceStatus(invoiceId: string) {
  const inv = await prisma.salesInvoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!inv) return;
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
  const status = paid >= inv.amount - 0.5 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
  if (status !== inv.status) await prisma.salesInvoice.update({ where: { id: invoiceId }, data: { status } });
}

// ── Customers ────────────────────────────────────────────────────────────────
router.get('/customers', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ customers: [] });
  const [customers, invoices, trust] = await Promise.all([
    prisma.customer.findMany({ where: { workspaceId: ws }, orderBy: { name: 'asc' } }),
    prisma.salesInvoice.findMany({ where: { workspaceId: ws }, select: { customerId: true, amount: true, status: true, payments: { select: { amount: true } } } }),
    computeTrust(ws),
  ]);
  const owedBy = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status === 'paid') continue;
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    const out = Math.max(0, inv.amount - paid);
    owedBy.set(inv.customerId, (owedBy.get(inv.customerId) || 0) + out);
  }
  res.json({
    customers: customers.map((c) => ({
      id: c.id, name: c.name, phone: c.phone,
      owed: Math.round(owedBy.get(c.id) || 0),
      trust: trust.get(c.id) || null,
    })),
  });
});

router.post('/customers', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Please enter a name' });
  const phone = String(req.body?.phone || '').trim() || null;
  const c = await prisma.customer.create({ data: { workspaceId: ws, name, phone } });
  res.status(201).json({ customer: { id: c.id, name: c.name, phone: c.phone, owed: 0 } });
});

router.patch('/customers/:id', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const existing = await prisma.customer.findFirst({ where: { id: req.params.id, workspaceId: ws } });
  if (!existing) return res.status(404).json({ error: 'Customer not found' });
  const data: Record<string, unknown> = {};
  if (req.body?.name != null) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: 'Please enter a name' });
    data.name = name;
  }
  if (req.body?.phone != null) data.phone = String(req.body.phone).trim() || null;
  const c = await prisma.customer.update({ where: { id: existing.id }, data });
  res.json({ customer: { id: c.id, name: c.name, phone: c.phone } });
});

router.delete('/customers/:id', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const existing = await prisma.customer.findFirst({ where: { id: req.params.id, workspaceId: ws } });
  if (!existing) return res.status(404).json({ error: 'Customer not found' });
  if (existing.name === 'Walk-in customer') return res.status(400).json({ error: 'The Walk-in customer can’t be deleted.' });
  const sales = await prisma.salesInvoice.count({ where: { customerId: existing.id } });
  if (sales > 0) return res.status(400).json({ error: 'This customer has sales history, so they can’t be deleted.' });
  await prisma.customer.delete({ where: { id: existing.id } });
  res.json({ ok: true, message: `${existing.name} deleted.` });
});

// ── Products / stock ─────────────────────────────────────────────────────────
router.get('/products', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ products: [] });
  const products = await prisma.product.findMany({ where: { workspaceId: ws }, orderBy: { name: 'asc' } });
  res.json({ products: products.map((p) => ({ ...p, low: p.stock <= p.reorderPoint })) });
});

// Is photo-to-inventory available (i.e. is a model key configured)?
router.get('/vision/available', (_req, res) => res.json({ available: visionAvailable() }));

// Read a photo of stock / a shelf / an invoice and propose products to add.
router.post('/vision/stock', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  if (!visionAvailable()) return res.status(400).json({ error: 'Photo scanning needs an OpenRouter key.', code: 'no_key' });
  if (!(await meterAI(ws, 'photo scan'))) return res.status(402).json({ error: 'You’re out of AI credits — top up in Settings to scan photos.' });
  const image = String(req.body?.image || '');
  if (!image.startsWith('data:image')) return res.status(400).json({ error: 'No image received.' });
  const items = await extractStockFromImage(image);
  if (!items) return res.status(502).json({ error: "INT couldn't read that photo. Try a clearer, well-lit picture." });
  res.json({ items });
});

// Add several products at once (from photo-to-inventory). Matches existing
// products by name (case-insensitive) and tops up their stock; otherwise creates.
router.post('/products/bulk', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const items: any[] = Array.isArray(req.body?.items) ? req.body.items : [];
  let created = 0;
  let updated = 0;
  for (const it of items) {
    const name = String(it?.name || '').trim();
    if (!name) continue;
    const qty = int(it.qty) || 0;
    const existing = await prisma.product.findFirst({ where: { workspaceId: ws, name: { equals: name, mode: 'insensitive' } } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { stock: existing.stock + qty, ...(num(it.price) > 0 ? { price: num(it.price) } : {}) },
      });
      updated++;
    } else {
      await prisma.product.create({
        data: {
          workspaceId: ws, name,
          price: num(it.price) || 0, cost: num(it.cost) || 0,
          stock: qty, reorderPoint: int(it.reorderPoint) || 0,
          unit: String(it.unit || 'unit').trim() || 'unit',
        },
      });
      created++;
    }
  }
  res.status(201).json({ created, updated, message: `Added ${created} new item${created === 1 ? '' : 's'}${updated ? `, updated ${updated}` : ''}.` });
});

router.post('/products', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Please enter a product name' });
  const price = num(b.price);
  const cost = num(b.cost);
  if (!(price >= 0) || !(cost >= 0)) return res.status(400).json({ error: 'Please enter a valid price and cost' });
  const p = await prisma.product.create({
    data: {
      workspaceId: ws,
      name,
      sku: String(b.sku || '').trim() || null,
      price,
      cost,
      stock: int(b.stock) || 0,
      reorderPoint: int(b.reorderPoint) || 0,
      unit: String(b.unit || 'unit').trim() || 'unit',
    },
  });
  res.status(201).json({ product: { ...p, low: p.stock <= p.reorderPoint } });
});

router.patch('/products/:id', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const existing = await prisma.product.findFirst({ where: { id: req.params.id, workspaceId: ws } });
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  const b = req.body || {};
  const data: Record<string, unknown> = {};
  if (b.name != null) data.name = String(b.name).trim();
  if (b.price != null) data.price = num(b.price);
  if (b.cost != null) data.cost = num(b.cost);
  if (b.stock != null) data.stock = int(b.stock);
  if (b.addStock != null) data.stock = existing.stock + int(b.addStock); // restock delta
  if (b.reorderPoint != null) data.reorderPoint = int(b.reorderPoint);
  if (b.unit != null) data.unit = String(b.unit).trim();
  const p = await prisma.product.update({ where: { id: existing.id }, data });
  res.json({ product: { ...p, low: p.stock <= p.reorderPoint } });
});

router.delete('/products/:id', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const existing = await prisma.product.findFirst({ where: { id: req.params.id, workspaceId: ws } });
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  // Don't let a delete quietly rewrite past sales totals.
  const used = await prisma.salesInvoiceItem.count({ where: { productId: existing.id } });
  if (used > 0) return res.status(400).json({ error: 'This product is in past sales, so it can’t be deleted. You can set its stock to 0 instead.' });
  await prisma.product.delete({ where: { id: existing.id } });
  res.json({ ok: true, message: `${existing.name} deleted.` });
});

// ── Record a sale ────────────────────────────────────────────────────────────
// body: { customerId?, items?: [{productId, qty, unitPrice?}], amount?, paidNow, method, dueInDays }
router.post('/sales', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const b = req.body || {};
  const paidNow = b.paidNow !== false; // default: paid at the counter
  const method = ['momo', 'cash', 'bank'].includes(b.method) ? b.method : 'cash';
  const dueInDays = Number.isFinite(num(b.dueInDays)) ? int(b.dueInDays) : 7;

  // Resolve line items (with a live price snapshot) or a free-form amount.
  const rawItems: any[] = Array.isArray(b.items) ? b.items : [];
  const lineItems: { productId: string; qty: number; unitPrice: number }[] = [];
  let amount = 0;
  for (const it of rawItems) {
    const qty = int(it.qty);
    if (!it.productId || !(qty > 0)) continue;
    const prod = await prisma.product.findFirst({ where: { id: it.productId, workspaceId: ws } });
    if (!prod) continue;
    const unitPrice = it.unitPrice != null ? num(it.unitPrice) : prod.price;
    lineItems.push({ productId: prod.id, qty, unitPrice });
    amount += qty * unitPrice;
  }
  if (lineItems.length === 0) {
    amount = num(b.amount);
    if (!(amount > 0)) return res.status(400).json({ error: 'Add at least one product, or enter an amount' });
  }

  const customerId = b.customerId || (await walkInCustomer(ws)).id;
  const number = await nextInvoiceNumber(ws);
  const now = new Date();

  const invoice = await prisma.salesInvoice.create({
    data: {
      workspaceId: ws,
      customerId,
      number,
      amount: Math.round(amount * 100) / 100,
      status: paidNow ? 'paid' : 'unpaid',
      issuedAt: now,
      dueAt: paidNow ? now : new Date(now.getTime() + dueInDays * DAY),
      items: lineItems.length ? { create: lineItems } : undefined,
    },
  });

  // Decrement stock for sold products.
  for (const li of lineItems) {
    await prisma.product.update({ where: { id: li.productId }, data: { stock: { decrement: li.qty } } });
  }

  // Record the payment if paid at the counter.
  if (paidNow) {
    await prisma.payment.create({ data: { workspaceId: ws, invoiceId: invoice.id, customerId, amount: invoice.amount, method, receivedAt: now } });
  }

  res.status(201).json({ invoice: { id: invoice.id, number: invoice.number, amount: invoice.amount, status: invoice.status }, message: `Sale recorded — GH₵ ${invoice.amount.toLocaleString()}${paidNow ? ' paid' : ' on credit'}.` });
});

router.get('/sales', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ sales: [] });
  const invoices = await prisma.salesInvoice.findMany({
    where: { workspaceId: ws },
    orderBy: { issuedAt: 'desc' },
    take: 40,
    select: { id: true, number: true, amount: true, status: true, issuedAt: true, customer: { select: { name: true } }, payments: { select: { amount: true } } },
  });
  res.json({
    sales: invoices.map((i) => {
      const paid = i.payments.reduce((s, p) => s + p.amount, 0);
      return { id: i.id, number: i.number, customer: i.customer.name, amount: i.amount, status: i.status, outstanding: Math.max(0, Math.round(i.amount - paid)), issuedAt: i.issuedAt };
    }),
  });
});

// Void a sale — puts the stock back, removes its payments, deletes the sale.
router.delete('/sales/:id', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const inv = await prisma.salesInvoice.findFirst({ where: { id: req.params.id, workspaceId: ws }, include: { items: true } });
  if (!inv) return res.status(404).json({ error: 'Sale not found' });
  // Restore stock for any line items.
  for (const it of inv.items) {
    await prisma.product.update({ where: { id: it.productId }, data: { stock: { increment: it.qty } } });
  }
  await prisma.payment.deleteMany({ where: { invoiceId: inv.id } }); // else cash would stay inflated
  await prisma.salesInvoice.delete({ where: { id: inv.id } });       // cascades line items
  res.json({ ok: true, message: `Sale ${inv.number} deleted.` });
});

// Full receipt for a past sale — used to re-send on WhatsApp or reprint.
router.get('/sales/:id/receipt', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const inv = await prisma.salesInvoice.findFirst({
    where: { id: req.params.id, workspaceId: ws },
    select: {
      number: true, amount: true, discount: true, tax: true, issuedAt: true, status: true,
      customer: { select: { name: true, phone: true } },
      items: { select: { qty: true, unitPrice: true, product: { select: { name: true } } } },
      payments: { select: { amount: true, method: true } },
    },
  });
  if (!inv) return res.status(404).json({ error: 'Sale not found' });
  const [workspace, settings] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: ws }, select: { name: true } }),
    prisma.storeSettings.findUnique({ where: { workspaceId: ws }, select: { receiptHeader: true, receiptFooter: true } }),
  ]);
  const shopName = workspace?.name && !/^(my |default )?workspace$/i.test(workspace.name) ? workspace.name : 'My Shop';
  const lines = inv.items.map((it) => ({ name: it.product.name, qty: it.qty, price: it.unitPrice }));
  const subtotal = Math.round(lines.reduce((s, l) => s + l.qty * l.price, 0));
  const paid = Math.round(inv.payments.reduce((s, p) => s + p.amount, 0));
  const method = inv.payments[0]?.method || (inv.status === 'paid' ? 'cash' : 'credit');
  res.json({
    shopName,
    receiptHeader: settings?.receiptHeader || null,
    receiptFooter: settings?.receiptFooter || 'Thank you! Come again.',
    number: inv.number,
    customer: inv.customer.name,
    phone: inv.customer.phone,
    issuedAt: inv.issuedAt,
    lines,
    subtotal,
    discount: Math.round(inv.discount || 0),
    tax: Math.round(inv.tax || 0),
    total: Math.round(inv.amount),
    method,
    paid,
    outstanding: Math.max(0, Math.round(inv.amount - paid)),
    currency: 'GH₵',
  });
});

// ── Record a payment (also used to "mark as paid") ───────────────────────────
// Cases:
//  - invoiceId  → pay that one sale.
//  - customerId → apply across the customer's unpaid sales, oldest first, so
//                 their "owed" figure actually drops. Leftover kept as credit.
router.post('/payments', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const b = req.body || {};
  const method = ['momo', 'cash', 'bank'].includes(b.method) ? b.method : 'cash';
  const invoiceId: string | null = b.invoiceId || null;
  const customerId: string | null = b.customerId || null;
  const now = new Date();
  let amount = num(b.amount);

  const outstandingOf = (inv: { amount: number; payments: { amount: number }[] }) =>
    Math.max(0, inv.amount - inv.payments.reduce((s, p) => s + p.amount, 0));

  if (invoiceId) {
    const inv = await prisma.salesInvoice.findFirst({ where: { id: invoiceId, workspaceId: ws }, include: { payments: true } });
    if (!inv) return res.status(404).json({ error: 'Sale not found' });
    if (!(amount > 0)) amount = outstandingOf(inv); // default: settle the full balance
    if (!(amount > 0)) return res.status(400).json({ error: 'Enter an amount' });
    await prisma.payment.create({ data: { workspaceId: ws, invoiceId, customerId: inv.customerId, amount, method, receivedAt: now } });
    await refreshInvoiceStatus(invoiceId);
    return res.status(201).json({ message: `Payment of GH₵ ${amount.toLocaleString()} recorded.` });
  }

  if (customerId) {
    const invoices = await prisma.salesInvoice.findMany({ where: { workspaceId: ws, customerId, status: { not: 'paid' } }, orderBy: { issuedAt: 'asc' }, include: { payments: true } });
    const totalOwed = invoices.reduce((s, i) => s + outstandingOf(i), 0);
    if (!(amount > 0)) amount = totalOwed; // default: clear their whole balance
    if (!(amount > 0)) return res.status(400).json({ error: 'Enter an amount' });
    let left = amount;
    for (const inv of invoices) {
      if (left <= 0.5) break;
      const due = outstandingOf(inv);
      const pay = Math.min(due, left);
      if (pay <= 0) continue;
      await prisma.payment.create({ data: { workspaceId: ws, invoiceId: inv.id, customerId, amount: pay, method, receivedAt: now } });
      await refreshInvoiceStatus(inv.id);
      left -= pay;
    }
    if (left > 0.5) {
      // Overpayment / credit with no open sale — keep it as an unassigned payment.
      await prisma.payment.create({ data: { workspaceId: ws, invoiceId: null, customerId, amount: left, method, receivedAt: now } });
    }
    return res.status(201).json({ message: `Payment of GH₵ ${amount.toLocaleString()} recorded.` });
  }

  if (!(amount > 0)) return res.status(400).json({ error: 'Enter an amount' });
  await prisma.payment.create({ data: { workspaceId: ws, invoiceId: null, customerId: null, amount, method, receivedAt: now } });
  res.status(201).json({ message: `Payment of GH₵ ${amount.toLocaleString()} recorded.` });
});

// ── Money capture: parse a pasted MoMo / bank message ────────────────────────
// Returns a proposal only; the client confirms and then calls the normal
// /payments, /sales or /expenses endpoints. Money entered at the till is a plain
// cash-in already — this is for messages that arrive outside a sale.
router.post('/money/parse', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Paste the message first.' });

  const parsed = parseMoneyMessage(text);

  // LLM fallback only when the deterministic parser is unsure.
  if (parsed.amount == null || parsed.direction === 'unknown') {
    const ai = await generateText(
      `You extract ONE money movement from a Ghanaian mobile-money or bank SMS. ` +
      `Reply with ONLY JSON: {"direction":"in|out","amount":number,"counterparty":string|null}. ` +
      `"in" = money received into the account; "out" = money sent, paid, or withdrawn.`,
      text,
    );
    if (ai) {
      try {
        const j = JSON.parse(ai.slice(ai.indexOf('{'), ai.lastIndexOf('}') + 1));
        if (parsed.amount == null && Number(j.amount) > 0) parsed.amount = Number(j.amount);
        if (parsed.direction === 'unknown' && (j.direction === 'in' || j.direction === 'out')) parsed.direction = j.direction;
        if (!parsed.counterparty && j.counterparty) parsed.counterparty = String(j.counterparty).trim();
      } catch { /* ignore bad JSON */ }
    }
    if (parsed.direction === 'out' && !parsed.category) parsed.category = guessCategory(text);
  }

  // For money in, try to match a customer who owes (by phone, then name).
  let matchedCustomerId: string | null = null;
  let matchedCustomerName: string | null = null;
  let matchedOwed = 0;
  if (parsed.direction === 'in') {
    const [customers, invoices] = await Promise.all([
      prisma.customer.findMany({ where: { workspaceId: ws }, select: { id: true, name: true, phone: true } }),
      prisma.salesInvoice.findMany({ where: { workspaceId: ws, status: { not: 'paid' } }, select: { customerId: true, amount: true, payments: { select: { amount: true } } } }),
    ]);
    const owedBy = new Map<string, number>();
    for (const inv of invoices) {
      const out = Math.max(0, inv.amount - inv.payments.reduce((s, p) => s + p.amount, 0));
      if (out > 0.5) owedBy.set(inv.customerId, (owedBy.get(inv.customerId) || 0) + out);
    }
    const wantPhone = (parsed.phone || '').replace(/\D/g, '').replace(/^233/, '0');
    const wantName = (parsed.counterparty || '').toLowerCase();
    let best: { id: string; name: string; owed: number } | null = null;
    for (const c of customers) {
      const owed = owedBy.get(c.id) || 0;
      if (owed <= 0.5) continue;
      const cPhone = (c.phone || '').replace(/\D/g, '').replace(/^233/, '0');
      const phoneHit = Boolean(wantPhone && cPhone && cPhone === wantPhone);
      const nameHit = Boolean(wantName && c.name.toLowerCase().split(/\s+/).some((w) => w.length > 2 && wantName.includes(w)));
      if (phoneHit || nameHit) { if (!best || owed > best.owed) best = { id: c.id, name: c.name, owed }; }
    }
    if (best) { matchedCustomerId = best.id; matchedCustomerName = best.name; matchedOwed = Math.round(best.owed); }
  }

  res.json({ ...parsed, matchedCustomerId, matchedCustomerName, matchedOwed, currency: 'GH₵' });
});

// ── Supplier bills / purchases (restocking) ─────────────────────────────────
// Record a supplier invoice: paid, on credit, or part-paid. The paid part also
// becomes an Expense so cash-on-hand stays correct; the rest is owed to the
// supplier. An optional photo of the invoice is stored (data URL).
router.post('/purchases', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const b = req.body || {};
  const supplier = String(b.supplier || '').trim() || 'Supplier';
  const amount = num(b.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'Enter the bill amount' });
  const amountPaid = Math.min(Math.max(0, num(b.amountPaid)), amount);
  const status = amountPaid >= amount ? 'paid' : amountPaid <= 0 ? 'credit' : 'partial';
  const note = String(b.note || '').trim() || null;
  const photo = typeof b.photo === 'string' && b.photo.startsWith('data:image') ? b.photo : null;

  const purchase = await prisma.purchase.create({ data: { workspaceId: ws, supplier, amount, amountPaid, status, note, photo } });
  // The money that left the till now → an expense so cash reflects it.
  if (amountPaid > 0) {
    await prisma.expense.create({
      data: { workspaceId: ws, category: 'Restock / buying stock', amount: amountPaid, note: `Supplier: ${supplier}${note ? ` — ${note}` : ''}`, spentAt: new Date() },
    });
  }
  res.status(201).json({ purchase: { ...purchase, photo: undefined }, message: `Supplier bill saved (${status}).` });
});

router.get('/purchases', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ purchases: [], owed: 0 });
  const rows = await prisma.purchase.findMany({ where: { workspaceId: ws }, orderBy: { createdAt: 'desc' }, take: 40 });
  const owed = rows.reduce((s, p) => s + Math.max(0, p.amount - p.amountPaid), 0);
  // Don't ship the (large) photo in the list; a detail fetch can add it later.
  res.json({ purchases: rows.map((p) => ({ ...p, photo: undefined, hasPhoto: Boolean(p.photo), outstanding: Math.max(0, Math.round(p.amount - p.amountPaid)) })), owed: Math.round(owed) });
});

// Pay down a supplier bill later (records the cash-out as an expense).
router.post('/purchases/:id/pay', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const existing = await prisma.purchase.findFirst({ where: { id: req.params.id, workspaceId: ws } });
  if (!existing) return res.status(404).json({ error: 'Bill not found' });
  const outstanding = Math.max(0, existing.amount - existing.amountPaid);
  let pay = num(req.body?.amount);
  if (!(pay > 0)) pay = outstanding; // default: settle it
  pay = Math.min(pay, outstanding);
  if (!(pay > 0)) return res.status(400).json({ error: 'Nothing left to pay' });
  const amountPaid = existing.amountPaid + pay;
  const status = amountPaid >= existing.amount ? 'paid' : 'partial';
  await prisma.purchase.update({ where: { id: existing.id }, data: { amountPaid, status } });
  await prisma.expense.create({
    data: { workspaceId: ws, category: 'Restock / buying stock', amount: pay, note: `Supplier: ${existing.supplier} (part payment)`, spentAt: new Date() },
  });
  res.json({ ok: true, message: `Paid GH₵ ${pay.toLocaleString()} to ${existing.supplier}.` });
});

// ── Expenses ─────────────────────────────────────────────────────────────────
router.get('/expenses', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ expenses: [] });
  const expenses = await prisma.expense.findMany({ where: { workspaceId: ws }, orderBy: { spentAt: 'desc' }, take: 40 });
  res.json({ expenses });
});

router.post('/expenses', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const b = req.body || {};
  const amount = num(b.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'Enter an amount' });
  const category = String(b.category || 'Other').trim() || 'Other';
  const e = await prisma.expense.create({ data: { workspaceId: ws, category, amount, note: String(b.note || '').trim() || null, spentAt: new Date() } });
  res.status(201).json({ expense: e, message: `Expense of GH₵ ${amount.toLocaleString()} recorded.` });
});

router.patch('/expenses/:id', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const existing = await prisma.expense.findFirst({ where: { id: req.params.id, workspaceId: ws } });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });
  const b = req.body || {};
  const data: Record<string, unknown> = {};
  if (b.amount != null) {
    const amount = num(b.amount);
    if (!(amount > 0)) return res.status(400).json({ error: 'Enter an amount' });
    data.amount = amount;
  }
  if (b.category != null) data.category = String(b.category).trim() || 'Other';
  if (b.note != null) data.note = String(b.note).trim() || null;
  const e = await prisma.expense.update({ where: { id: existing.id }, data });
  res.json({ expense: e });
});

router.delete('/expenses/:id', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const existing = await prisma.expense.findFirst({ where: { id: req.params.id, workspaceId: ws } });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });
  await prisma.expense.delete({ where: { id: existing.id } });
  res.json({ ok: true, message: 'Expense deleted.' });
});

export default router;
