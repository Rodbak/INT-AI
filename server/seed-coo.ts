import { randomBytes, scryptSync } from 'node:crypto';
import { prisma } from './src/db.js';

const USER = '00000000-0000-0000-0000-000000000000';
const hashPin = (pin: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pin, salt, 32).toString('hex')}`;
};
const now = Date.now();
const day = 86400000;
const daysAgo = (n: number) => new Date(now - n * day);
const inDays = (n: number) => new Date(now + n * day);

async function main() {
  const ws = await prisma.workspace.findFirst({ where: { users: { some: { userId: USER } } } });
  if (!ws) throw new Error('no workspace');
  const w = ws.id;

  // Clean prior demo business data (idempotent).
  await prisma.salesInvoiceItem.deleteMany({ where: { invoice: { workspaceId: w } } });
  await prisma.payment.deleteMany({ where: { workspaceId: w } });
  await prisma.salesInvoice.deleteMany({ where: { workspaceId: w } });
  await prisma.expense.deleteMany({ where: { workspaceId: w } });
  await prisma.customer.deleteMany({ where: { workspaceId: w } });
  await prisma.product.deleteMany({ where: { workspaceId: w } });
  await prisma.cooAction.deleteMany({ where: { workspaceId: w } });
  await prisma.shift.deleteMany({ where: { workspaceId: w } });
  await prisma.cashier.deleteMany({ where: { workspaceId: w } });

  // Give the demo business a name so the greeting is personalised.
  await prisma.workspace.update({ where: { id: w }, data: { name: 'Ama’s Provisions' } });

  // POS store settings + a demo cashier (Akosua, PIN 1234).
  await prisma.storeSettings.upsert({
    where: { workspaceId: w },
    update: { barcodeEnabled: true, printerEnabled: true, cashDrawer: false, taxEnabled: false, receiptHeader: 'Kaneshie Market, Accra · 024 000 0000' },
    create: { workspaceId: w, barcodeEnabled: true, printerEnabled: true, receiptHeader: 'Kaneshie Market, Accra · 024 000 0000' },
  });
  await prisma.cashier.create({ data: { workspaceId: w, name: 'Akosua', pinHash: hashPin('1234') } });

  // --- Products (a provisions / building-supplies shop) ---
  const P = async (name: string, price: number, cost: number, stock: number, reorder: number, unit: string, category: string, barcode: string) =>
    prisma.product.create({ data: { workspaceId: w, name, price, cost, stock, reorderPoint: reorder, unit, category, barcode } });
  const rice = await P('Rice (50kg)', 520, 430, 12, 5, 'bag', 'Provisions', '6001001');
  const cement = await P('Cement', 62, 52, 4, 10, 'bag', 'Building', '6001002'); // LOW
  const oil = await P('Cooking Oil (5L)', 95, 78, 20, 8, 'gallon', 'Provisions', '6001003');
  const sugar = await P('Sugar (25kg)', 340, 300, 3, 6, 'bag', 'Provisions', '6001004'); // LOW
  const milk = await P('Milk (carton)', 180, 150, 15, 5, 'carton', 'Provisions', '6001005');
  const soap = await P('Soap (box)', 210, 175, 9, 4, 'box', 'Household', '6001006');
  const flour = await P('Flour (50kg)', 410, 360, 7, 5, 'bag', 'Provisions', '6001007');
  const tomato = await P('Tin Tomatoes (carton)', 240, 205, 2, 6, 'carton', 'Provisions', '6001008'); // LOW

  // --- Customers ---
  const C = async (name: string, phone: string) => prisma.customer.create({ data: { workspaceId: w, name, phone } });
  const kofi = await C('Kofi Mensah', '024 555 0101');
  const ama = await C('Ama Owusu', '020 555 0102');
  const kwame = await C('Kwame Boateng', '054 555 0103');
  const adjoa = await C('Adjoa Serwaa', '027 555 0104');
  const yaw = await C('Yaw Darko', '055 555 0105');
  const efua = await C('Efua Ansah', '024 555 0106');

  let inv = 1000;
  // Create an invoice with items; optionally record a payment.
  const makeInvoice = async (
    customer: { id: string },
    items: { product: any; qty: number }[],
    opts: { issued: number; due: number; paid?: number },
  ) => {
    const customerId = customer.id;
    const amount = items.reduce((s, it) => s + it.qty * it.product.price, 0);
    const status = opts.paid === undefined ? 'unpaid' : opts.paid >= amount ? 'paid' : 'partial';
    const invoice = await prisma.salesInvoice.create({
      data: {
        workspaceId: w,
        customerId,
        number: `INV-${++inv}`,
        amount,
        status,
        issuedAt: daysAgo(opts.issued),
        dueAt: opts.due < 0 ? inDays(-opts.due) : daysAgo(opts.due),
        items: { create: items.map((it) => ({ productId: it.product.id, qty: it.qty, unitPrice: it.product.price })) },
      },
    });
    if (opts.paid !== undefined && opts.paid > 0) {
      await prisma.payment.create({
        data: { workspaceId: w, invoiceId: invoice.id, customerId, amount: opts.paid, method: 'momo', receivedAt: daysAgo(Math.max(0, opts.issued - 1)) },
      });
    }
    return invoice;
  };

  // Paid invoices (cash in) across the last ~3 weeks
  await makeInvoice(kofi, [{ product: rice, qty: 2 }, { product: oil, qty: 3 }], { issued: 20, due: 13, paid: 1325 });
  await makeInvoice(ama, [{ product: milk, qty: 6 }, { product: soap, qty: 2 }], { issued: 17, due: 10, paid: 1500 });
  await makeInvoice(kwame, [{ product: flour, qty: 3 }], { issued: 14, due: 7, paid: 1230 });
  await makeInvoice(efua, [{ product: rice, qty: 1 }, { product: sugar, qty: 1 }], { issued: 9, due: 2, paid: 860 });
  await makeInvoice(yaw, [{ product: oil, qty: 4 }], { issued: 6, due: 1, paid: 380 });
  await makeInvoice(ama, [{ product: milk, qty: 4 }], { issued: 4, due: -3, paid: 720 });
  await makeInvoice(kofi, [{ product: soap, qty: 3 }], { issued: 2, due: -5, paid: 630 });

  // Outstanding (who owes) — overdue and current
  await makeInvoice(kofi, [{ product: cement, qty: 10 }, { product: rice, qty: 1 }], { issued: 16, due: 12 }); // GH₵1,140, 12d overdue
  await makeInvoice(adjoa, [{ product: sugar, qty: 2 }], { issued: 12, due: 8 }); // GH₵680, 8d overdue
  await makeInvoice(yaw, [{ product: flour, qty: 1 }, { product: oil, qty: 2 }], { issued: 8, due: 4 }); // 4d overdue
  await makeInvoice(kwame, [{ product: milk, qty: 3 }], { issued: 3, due: -4, paid: 200 }); // partial, not yet due

  // --- Realistic daily over-the-counter (POS) sales for the last ~45 days ---
  // Gives the reports, trend chart, busiest-day and forecasting real texture.
  const walkin = await C('Walk-in customer', '');
  const catalog = [rice, cement, oil, sugar, milk, soap, flour, tomato];
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  let dailyCount = 0;
  for (let d = 45; d >= 0; d--) {
    const date = daysAgo(d);
    const dow = date.getDay(); // 0 Sun … 6 Sat
    const base = dow === 0 ? 1 : dow === 5 || dow === 6 ? 4 : 2; // busier Fri/Sat, quiet Sun
    const count = Math.max(0, Math.round(base + rand(-1, 1)));
    // Make yesterday a strong day so the "best day" celebration can fire in demos.
    const extra = d === 1 ? 3 : 0;
    for (let s = 0; s < count + extra; s++) {
      const item = catalog[Math.floor(Math.random() * catalog.length)];
      const qty = 1 + Math.floor(Math.random() * (item.price > 300 ? 2 : 4));
      const amount = qty * item.price;
      const issuedAt = new Date(date.getTime() + rand(8, 18) * 3600000);
      const si = await prisma.salesInvoice.create({
        data: {
          workspaceId: w, customerId: walkin.id, number: `INV-${++inv}`, amount,
          status: 'paid', channel: 'pos', issuedAt, dueAt: issuedAt,
          items: { create: [{ productId: item.id, qty, unitPrice: item.price }] },
        },
      });
      await prisma.payment.create({
        data: { workspaceId: w, invoiceId: si.id, customerId: walkin.id, amount, method: Math.random() < 0.5 ? 'cash' : 'momo', receivedAt: issuedAt },
      });
      dailyCount++;
    }
  }
  console.log('  seeded daily POS sales:', dailyCount);

  // --- Expenses (cash out) ---
  const E = async (category: string, amount: number, note: string, d: number) =>
    prisma.expense.create({ data: { workspaceId: w, category, amount, note, spentAt: daysAgo(d) } });
  await E('Rent', 1200, 'Shop rent', 18);
  await E('Restock', 2600, 'Supplier — rice & oil', 15);
  await E('Transport', 180, 'Delivery van fuel', 10);
  await E('Electricity', 240, 'ECG bill', 7);
  await E('Wages', 900, 'Two staff', 5);
  await E('Restock', 800, 'Milk & soap', 3);

  const [pay, exp, invs, prods] = await Promise.all([
    prisma.payment.aggregate({ where: { workspaceId: w }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { workspaceId: w }, _sum: { amount: true } }),
    prisma.salesInvoice.count({ where: { workspaceId: w } }),
    prisma.product.count({ where: { workspaceId: w } }),
  ]);
  console.log('SEEDED business for workspace', w);
  console.log('  products', prods, 'invoices', invs, 'payments GH₵', pay._sum.amount, 'expenses GH₵', exp._sum.amount);
  console.log('  cash on hand ≈ GH₵', (pay._sum.amount || 0) - (exp._sum.amount || 0));
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
