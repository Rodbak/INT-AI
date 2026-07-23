import { useEffect, useMemo, useRef, useState } from 'react';
import { cedis } from '../../lib/money';
import { queueSale, type PosCatalog, type PosProduct, type QueuedSale } from '../../lib/pos';

interface Line { product: PosProduct; qty: number }
interface Session { cashierId: string; cashierName: string; shiftId: string }

interface Props {
  catalog: PosCatalog;
  session: Session;
  online: boolean;
  pending: number;
  onCloseShift: () => void;
  onExit: () => void;
  onSold: () => void; // refresh pending count / catalog stock
}

const METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'momo', label: 'MoMo' },
  { id: 'card', label: 'Card' },
];

export default function Till({ catalog, session, online, pending, onCloseShift, onExit, onSold }: Props) {
  const { settings } = catalog;
  const [products, setProducts] = useState<PosProduct[]>(catalog.products);
  const [cart, setCart] = useState<Line[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [discount, setDiscount] = useState(0);
  const [pay, setPay] = useState(false);
  const [method, setMethod] = useState('cash');
  const [tendered, setTendered] = useState('');
  const [receipt, setReceipt] = useState<null | ReceiptData>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setProducts(catalog.products); }, [catalog]);
  useEffect(() => { if (settings.barcodeEnabled && !pay && !receipt) scanRef.current?.focus(); }, [settings.barcodeEnabled, pay, receipt, cart]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return ['All', ...[...set].sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) =>
      (category === 'All' || p.category === category) &&
      (!q || p.name.toLowerCase().includes(q)),
    );
  }, [products, query, category]);

  // ── cart ops ──
  const add = (p: PosProduct) => {
    setCart((c) => {
      const i = c.findIndex((l) => l.product.id === p.id);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: n[i].qty + 1 }; return n; }
      return [...c, { product: p, qty: 1 }];
    });
  };
  const setQty = (id: string, qty: number) =>
    setCart((c) => (qty <= 0 ? c.filter((l) => l.product.id !== id) : c.map((l) => (l.product.id === id ? { ...l, qty } : l))));
  const clear = () => { setCart([]); setDiscount(0); };

  // ── totals ──
  const subtotal = cart.reduce((s, l) => s + l.qty * l.product.price, 0);
  const discountAmt = Math.min(discount, subtotal);
  const taxable = subtotal - discountAmt;
  const rates = settings.taxEnabled && Array.isArray(settings.taxRates) ? settings.taxRates : [];
  const totalRate = rates.reduce((s, r) => s + (r.rate || 0), 0);
  const taxExclusive = settings.taxEnabled && !settings.taxInclusive ? taxable * (totalRate / 100) : 0;
  const taxIncluded = settings.taxEnabled && settings.taxInclusive ? taxable - taxable / (1 + totalRate / 100) : 0;
  const total = Math.round((taxable + taxExclusive) * 100) / 100;

  const tenderedNum = parseFloat(tendered) || 0;
  const change = method === 'cash' ? Math.max(0, tenderedNum - total) : 0;

  const onScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const code = query.trim();
    if (!code) return;
    const hit = products.find((p) => p.barcode === code || p.sku === code);
    if (hit) { add(hit); setQuery(''); }
  };

  const confirmSale = async () => {
    const items = cart.map((l) => ({ productId: l.product.id, qty: l.qty, unitPrice: l.product.price }));
    const sale: QueuedSale = {
      clientId: crypto.randomUUID(),
      items,
      discount: Math.round(discountAmt * 100) / 100,
      tax: Math.round(taxExclusive * 100) / 100,
      method,
      tendered: method === 'cash' ? tenderedNum : total,
      amount: total,
      cashierId: session.cashierId,
      shiftId: session.shiftId,
      soldAt: new Date().toISOString(),
    };
    await queueSale(sale);
    // reflect the stock drop locally
    setProducts((ps) => ps.map((p) => { const li = cart.find((l) => l.product.id === p.id); return li ? { ...p, stock: p.stock - li.qty } : p; }));
    setReceipt({
      lines: cart.map((l) => ({ name: l.product.name, qty: l.qty, price: l.product.price })),
      subtotal, discount: discountAmt, tax: taxExclusive || taxIncluded, taxInclusive: settings.taxInclusive,
      total, method, tendered: sale.tendered, change, at: new Date(),
    });
    setPay(false); setTendered('');
    clear();
    onSold();
    if (settings.cashDrawer && method === 'cash') { /* a connected drawer opens via the receipt printer */ }
  };

  return (
    <div className="till">
      {/* Top bar */}
      <div className="till__top">
        <button className="till__exit" onClick={onExit} title="Back to dashboard">✕</button>
        <div className="till__shop">{catalog.shopName}</div>
        <div className={`till__net ${online ? 'is-online' : 'is-off'}`}>
          <span className="till__net-dot" />{online ? 'Online' : 'Offline'}
          {pending > 0 && <span className="till__pending">{pending} to sync</span>}
        </div>
        <div className="till__spacer" />
        <div className="till__cashier">{session.cashierName}</div>
        <button className="till__close" onClick={onCloseShift}>Close shift</button>
      </div>

      <div className="till__body">
        {/* Products */}
        <div className="till__products">
          <input
            ref={scanRef}
            className="till__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onScan}
            placeholder={settings.barcodeEnabled ? 'Scan barcode or search…' : 'Search products…'}
          />
          {categories.length > 1 && (
            <div className="till__cats">
              {categories.map((c) => (
                <button key={c} className={`till__cat${c === category ? ' on' : ''}`} onClick={() => setCategory(c)}>{c}</button>
              ))}
            </div>
          )}
          <div className="till__grid">
            {filtered.length === 0 && <div className="till__empty">No products found.</div>}
            {filtered.map((p) => (
              <button key={p.id} className={`till__tile${p.stock <= 0 ? ' is-out' : ''}`} onClick={() => add(p)}>
                <div className="till__tile-name">{p.name}</div>
                <div className="till__tile-price">{cedis(p.price)}</div>
                <div className={`till__tile-stock${p.stock <= p.reorderPoint ? ' low' : ''}`}>{p.stock} {p.unit} left</div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="till__cart">
          <div className="till__cart-head">
            <span>Current sale</span>
            {cart.length > 0 && <button className="till__clear" onClick={clear}>Clear</button>}
          </div>
          <div className="till__lines">
            {cart.length === 0 && <div className="till__cart-empty">Tap a product to start a sale.</div>}
            {cart.map((l) => (
              <div key={l.product.id} className="till__line">
                <div className="till__line-info">
                  <div className="till__line-name">{l.product.name}</div>
                  <div className="till__line-sub">{cedis(l.product.price)} each</div>
                </div>
                <div className="till__stepper">
                  <button onClick={() => setQty(l.product.id, l.qty - 1)}>−</button>
                  <span>{l.qty}</span>
                  <button onClick={() => setQty(l.product.id, l.qty + 1)}>＋</button>
                </div>
                <div className="till__line-amt">{cedis(l.qty * l.product.price)}</div>
              </div>
            ))}
          </div>

          <div className="till__totals">
            <div className="till__trow"><span>Subtotal</span><span>{cedis(subtotal)}</span></div>
            <div className="till__trow till__trow--disc">
              <span>Discount</span>
              <input className="till__disc" type="number" inputMode="decimal" value={discount || ''} onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))} placeholder="0" />
            </div>
            {taxExclusive > 0 && <div className="till__trow"><span>Tax ({totalRate}%)</span><span>{cedis(taxExclusive)}</span></div>}
            {taxIncluded > 0 && <div className="till__trow till__muted"><span>incl. tax</span><span>{cedis(taxIncluded)}</span></div>}
            <div className="till__trow till__trow--total"><span>Total</span><span>{cedis(total)}</span></div>
          </div>

          <button className="till__charge" disabled={cart.length === 0} onClick={() => { setMethod('cash'); setTendered(''); setPay(true); }}>
            Charge {cedis(total)}
          </button>
        </div>
      </div>

      {/* Payment sheet */}
      {pay && (
        <div className="till__overlay" onClick={() => setPay(false)}>
          <div className="till__sheet" onClick={(e) => e.stopPropagation()}>
            <div className="till__sheet-total">{cedis(total)}</div>
            <div className="till__methods">
              {METHODS.map((m) => (
                <button key={m.id} className={`till__method${method === m.id ? ' on' : ''}`} onClick={() => setMethod(m.id)}>{m.label}</button>
              ))}
            </div>
            {method === 'cash' && (
              <div className="till__cash">
                <label className="till__cash-label">Cash received</label>
                <input className="till__cash-input" type="number" inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={String(total)} autoFocus />
                <div className="till__quick">
                  {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100]
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((v) => <button key={v} onClick={() => setTendered(String(v))}>{cedis(v)}</button>)}
                </div>
                <div className="till__change"><span>Change</span><b>{cedis(change)}</b></div>
              </div>
            )}
            <div className="till__sheet-actions">
              <button className="till__sheet-cancel" onClick={() => setPay(false)}>Cancel</button>
              <button className="till__sheet-done" disabled={method === 'cash' && tenderedNum < total} onClick={confirmSale}>Complete sale</button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt */}
      {receipt && (
        <Receipt data={receipt} catalog={catalog} cashier={session.cashierName} onNew={() => setReceipt(null)} />
      )}
    </div>
  );
}

interface ReceiptData {
  lines: { name: string; qty: number; price: number }[];
  subtotal: number; discount: number; tax: number; taxInclusive: boolean;
  total: number; method: string; tendered: number; change: number; at: Date;
}

function Receipt({ data, catalog, cashier, onNew }: { data: ReceiptData; catalog: PosCatalog; cashier: string; onNew: () => void }) {
  const { settings } = catalog;
  const waText = () => {
    const lines = data.lines.map((l) => `${l.qty} x ${l.name} — ${cedis(l.qty * l.price)}`).join('%0A');
    const msg = `*${catalog.shopName}*%0A${lines}%0A%0ATotal: ${cedis(data.total)}%0APaid: ${data.method.toUpperCase()}%0A%0A${settings.receiptFooter || 'Thank you!'}`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };
  return (
    <div className="till__overlay">
      <div className="till__receipt-wrap">
        <div className="receipt-paper" id="receipt">
          <div className="receipt-shop">{catalog.shopName}</div>
          {settings.receiptHeader && <div className="receipt-header">{settings.receiptHeader}</div>}
          <div className="receipt-meta">{data.at.toLocaleString('en-GB')} · {cashier}</div>
          <div className="receipt-rule" />
          {data.lines.map((l, i) => (
            <div key={i} className="receipt-line"><span>{l.qty} × {l.name}</span><span>{cedis(l.qty * l.price)}</span></div>
          ))}
          <div className="receipt-rule" />
          <div className="receipt-line"><span>Subtotal</span><span>{cedis(data.subtotal)}</span></div>
          {data.discount > 0 && <div className="receipt-line"><span>Discount</span><span>−{cedis(data.discount)}</span></div>}
          {data.tax > 0 && <div className="receipt-line"><span>{data.taxInclusive ? 'incl. tax' : 'Tax'}</span><span>{cedis(data.tax)}</span></div>}
          <div className="receipt-line receipt-total"><span>TOTAL</span><span>{cedis(data.total)}</span></div>
          <div className="receipt-line"><span>{data.method.toUpperCase()}</span><span>{cedis(data.tendered)}</span></div>
          {data.change > 0 && <div className="receipt-line"><span>Change</span><span>{cedis(data.change)}</span></div>}
          <div className="receipt-rule" />
          <div className="receipt-footer">{settings.receiptFooter || 'Thank you!'}</div>
        </div>
        <div className="till__receipt-actions">
          <button className="till__r-new" onClick={onNew}>New sale</button>
          {settings.printerEnabled && <button className="till__r-btn" onClick={() => window.print()}>Print</button>}
          <button className="till__r-btn" onClick={waText}>WhatsApp</button>
        </div>
      </div>
    </div>
  );
}
