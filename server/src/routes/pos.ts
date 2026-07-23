import { Router } from 'express';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { prisma } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types.js';
import { resolveWorkspaceId } from './coo.js';

const router = Router();
router.use(optionalAuth);

const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : parseFloat(String(v)) || 0);
const int = (v: unknown) => Math.round(num(v));

// ── PIN hashing ──────────────────────────────────────────────────────────────
function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = scryptSync(pin, salt, 32);
  const orig = Buffer.from(hash, 'hex');
  return orig.length === test.length && timingSafeEqual(orig, test);
}

// ── shared helpers ───────────────────────────────────────────────────────────
async function nextInvoiceNumber(workspaceId: string): Promise<string> {
  const count = await prisma.salesInvoice.count({ where: { workspaceId } });
  return `INV-${1000 + count + 1}`;
}
async function walkInCustomer(workspaceId: string) {
  const existing = await prisma.customer.findFirst({ where: { workspaceId, name: 'Walk-in customer' } });
  if (existing) return existing;
  return prisma.customer.create({ data: { workspaceId, name: 'Walk-in customer' } });
}
async function getOrCreateSettings(workspaceId: string) {
  let s = await prisma.storeSettings.findUnique({ where: { workspaceId } });
  if (!s) s = await prisma.storeSettings.create({ data: { workspaceId } });
  return s;
}

// ── Bootstrap: everything the till needs to run (also cached offline) ─────────
router.get('/bootstrap', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ empty: true });
  const [products, customers, settings, cashiers, workspace] = await Promise.all([
    prisma.product.findMany({ where: { workspaceId: ws }, orderBy: { name: 'asc' } }),
    prisma.customer.findMany({ where: { workspaceId: ws }, orderBy: { name: 'asc' } }),
    getOrCreateSettings(ws),
    prisma.cashier.findMany({ where: { workspaceId: ws, active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.workspace.findUnique({ where: { id: ws }, select: { name: true } }),
  ]);
  res.json({
    shopName: workspace?.name && !/^(my |default )?workspace$/i.test(workspace.name) ? workspace.name : 'My Shop',
    products,
    customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
    settings,
    cashiers,
    currency: 'GH₵',
  });
});

// ── Store settings ───────────────────────────────────────────────────────────
router.get('/settings', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  res.json({ settings: await getOrCreateSettings(ws) });
});

router.patch('/settings', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  await getOrCreateSettings(ws);
  const b = req.body || {};
  const data: Record<string, unknown> = {};
  for (const k of ['taxEnabled', 'taxInclusive', 'barcodeEnabled', 'printerEnabled', 'cashDrawer'] as const) {
    if (b[k] != null) data[k] = !!b[k];
  }
  if (b.taxRates != null) data.taxRates = Array.isArray(b.taxRates) ? b.taxRates : undefined;
  if (b.receiptHeader != null) data.receiptHeader = String(b.receiptHeader).slice(0, 200) || null;
  if (b.receiptFooter != null) data.receiptFooter = String(b.receiptFooter).slice(0, 200) || null;
  const settings = await prisma.storeSettings.update({ where: { workspaceId: ws }, data });
  res.json({ settings });
});

// ── Cashiers ─────────────────────────────────────────────────────────────────
router.get('/cashiers', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ cashiers: [] });
  const cashiers = await prisma.cashier.findMany({ where: { workspaceId: ws }, select: { id: true, name: true, active: true }, orderBy: { name: 'asc' } });
  res.json({ cashiers });
});

router.post('/cashiers', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const name = String(req.body?.name || '').trim();
  const pin = String(req.body?.pin || '').trim();
  if (!name) return res.status(400).json({ error: 'Please enter a name' });
  if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4–6 digits' });
  const c = await prisma.cashier.create({ data: { workspaceId: ws, name, pinHash: hashPin(pin) } });
  res.status(201).json({ cashier: { id: c.id, name: c.name, active: c.active } });
});

router.patch('/cashiers/:id', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const existing = await prisma.cashier.findFirst({ where: { id: req.params.id, workspaceId: ws } });
  if (!existing) return res.status(404).json({ error: 'Cashier not found' });
  const b = req.body || {};
  const data: Record<string, unknown> = {};
  if (b.name != null) data.name = String(b.name).trim();
  if (b.active != null) data.active = !!b.active;
  if (b.pin != null) {
    const pin = String(b.pin).trim();
    if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4–6 digits' });
    data.pinHash = hashPin(pin);
  }
  const c = await prisma.cashier.update({ where: { id: existing.id }, data });
  res.json({ cashier: { id: c.id, name: c.name, active: c.active } });
});

router.delete('/cashiers/:id', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const existing = await prisma.cashier.findFirst({ where: { id: req.params.id, workspaceId: ws } });
  if (!existing) return res.status(404).json({ error: 'Cashier not found' });
  await prisma.cashier.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

router.post('/cashiers/login', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const c = await prisma.cashier.findFirst({ where: { id: String(req.body?.cashierId || ''), workspaceId: ws, active: true } });
  if (!c || !verifyPin(String(req.body?.pin || ''), c.pinHash)) return res.status(401).json({ error: 'Wrong PIN' });
  res.json({ ok: true, cashier: { id: c.id, name: c.name } });
});

// ── Shifts ───────────────────────────────────────────────────────────────────
router.post('/shifts/open', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const cashierId = String(req.body?.cashierId || '');
  const cashier = await prisma.cashier.findFirst({ where: { id: cashierId, workspaceId: ws } });
  if (!cashier) return res.status(404).json({ error: 'Cashier not found' });
  const open = await prisma.shift.findFirst({ where: { workspaceId: ws, cashierId, status: 'open' } });
  if (open) return res.json({ shift: open });
  const shift = await prisma.shift.create({ data: { workspaceId: ws, cashierId, openingFloat: num(req.body?.openingFloat) } });
  res.status(201).json({ shift });
});

async function shiftReport(workspaceId: string, shiftId: string) {
  const shift = await prisma.shift.findFirst({ where: { id: shiftId, workspaceId }, include: { cashier: { select: { name: true } } } });
  if (!shift) return null;
  const invoices = await prisma.salesInvoice.findMany({
    where: { workspaceId, shiftId },
    select: { amount: true, tax: true, discount: true, payments: { select: { amount: true, method: true } } },
  });
  const byMethod: Record<string, number> = { cash: 0, momo: 0, card: 0, bank: 0 };
  let sales = 0;
  for (const inv of invoices) {
    sales += inv.amount;
    for (const p of inv.payments) byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
  }
  const expectedCash = shift.openingFloat + (byMethod.cash || 0);
  return {
    id: shift.id,
    cashier: shift.cashier.name,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    status: shift.status,
    openingFloat: shift.openingFloat,
    salesCount: invoices.length,
    salesTotal: Math.round(sales),
    byMethod: Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, Math.round(v)])),
    expectedCash: Math.round(expectedCash),
    countedCash: shift.countedCash != null ? Math.round(shift.countedCash) : null,
    variance: shift.countedCash != null ? Math.round(shift.countedCash - expectedCash) : null,
  };
}

router.get('/shifts/current', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.json({ shift: null });
  const cashierId = String(req.query.cashierId || '');
  const shift = await prisma.shift.findFirst({ where: { workspaceId: ws, cashierId, status: 'open' }, orderBy: { openedAt: 'desc' } });
  if (!shift) return res.json({ shift: null });
  res.json({ shift: await shiftReport(ws, shift.id) });
});

router.get('/shifts/:id/report', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const report = await shiftReport(ws, req.params.id);
  if (!report) return res.status(404).json({ error: 'Shift not found' });
  res.json({ report });
});

router.post('/shifts/:id/close', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const shift = await prisma.shift.findFirst({ where: { id: req.params.id, workspaceId: ws } });
  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  await prisma.shift.update({ where: { id: shift.id }, data: { status: 'closed', closedAt: new Date(), countedCash: num(req.body?.countedCash) } });
  res.json({ report: await shiftReport(ws, shift.id) });
});

// ── Recording a POS sale (used by /sale and by /sync) ────────────────────────
interface PosSaleInput {
  clientId: string;
  items: { productId: string; qty: number; unitPrice: number }[];
  discount?: number;
  tax?: number;
  method?: string;
  tendered?: number;
  customerId?: string | null;
  cashierId?: string | null;
  shiftId?: string | null;
  soldAt?: string;
}

async function recordPosSale(workspaceId: string, input: PosSaleInput) {
  // Idempotency: if this offline sale was already synced, don't duplicate it.
  if (input.clientId) {
    const existing = await prisma.salesInvoice.findUnique({ where: { clientId: input.clientId }, select: { id: true, number: true } });
    if (existing) return { duplicate: true, id: existing.id, number: existing.number };
  }

  const lineItems: { productId: string; qty: number; unitPrice: number }[] = [];
  let subtotal = 0;
  for (const it of input.items || []) {
    const qty = int(it.qty);
    if (!it.productId || qty <= 0) continue;
    const unitPrice = num(it.unitPrice);
    lineItems.push({ productId: it.productId, qty, unitPrice });
    subtotal += qty * unitPrice;
  }
  if (lineItems.length === 0) throw new Error('empty sale');

  const discount = Math.max(0, num(input.discount));
  const tax = Math.max(0, num(input.tax));
  const amount = Math.max(0, Math.round((subtotal - discount + tax) * 100) / 100);
  const method = ['cash', 'momo', 'card', 'bank'].includes(input.method || '') ? input.method! : 'cash';
  const tendered = input.tendered != null ? num(input.tendered) : amount;
  const change = method === 'cash' ? Math.max(0, Math.round((tendered - amount) * 100) / 100) : 0;
  const customerId = input.customerId || (await walkInCustomer(workspaceId)).id;
  const soldAt = input.soldAt ? new Date(input.soldAt) : new Date();
  const number = await nextInvoiceNumber(workspaceId);

  const invoice = await prisma.salesInvoice.create({
    data: {
      workspaceId, customerId, number, amount, status: 'paid',
      issuedAt: soldAt, dueAt: soldAt, channel: 'pos',
      discount, tax, tendered, change,
      cashierId: input.cashierId || null, shiftId: input.shiftId || null,
      clientId: input.clientId || null,
      items: { create: lineItems },
    },
  });
  for (const li of lineItems) {
    await prisma.product.update({ where: { id: li.productId }, data: { stock: { decrement: li.qty } } });
  }
  await prisma.payment.create({ data: { workspaceId, invoiceId: invoice.id, customerId, amount, method, receivedAt: soldAt } });
  return { duplicate: false, id: invoice.id, number: invoice.number };
}

router.post('/sale', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  try {
    const result = await recordPosSale(ws, req.body || {});
    res.status(201).json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Could not record sale' });
  }
});

// Batch sync of sales that were made offline. Idempotent per clientId.
router.post('/sync', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const sales: PosSaleInput[] = Array.isArray(req.body?.sales) ? req.body.sales : [];
  const saved: string[] = [];
  const failed: { clientId: string; error: string }[] = [];
  for (const s of sales) {
    try {
      await recordPosSale(ws, s);
      if (s.clientId) saved.push(s.clientId);
    } catch (e) {
      failed.push({ clientId: s.clientId, error: e instanceof Error ? e.message : 'failed' });
    }
  }
  res.json({ ok: true, saved, failed });
});

// Barcode lookup (online fallback; offline the till uses its local cache)
router.get('/barcode/:code', async (req: AuthenticatedRequest, res) => {
  const ws = await resolveWorkspaceId(req);
  if (!ws) return res.status(400).json({ error: 'No business' });
  const code = req.params.code;
  const product = await prisma.product.findFirst({ where: { workspaceId: ws, OR: [{ barcode: code }, { sku: code }] } });
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json({ product });
});

export default router;
