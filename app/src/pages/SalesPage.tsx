import { useEffect, useMemo, useState } from 'react';
import BizSheet from '../components/BizSheet';
import { cedis } from '../lib/money';
import {
  getSales, recordSale, deleteSale, getCustomers, getProducts,
  type CooSale, type CooCustomer, type CooProduct,
} from '../lib/api';
import './Business.css';

const METHODS: { id: string; label: string }[] = [
  { id: 'momo', label: 'MoMo' },
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank' },
];

export default function SalesPage() {
  const [sales, setSales] = useState<CooSale[]>([]);
  const [customers, setCustomers] = useState<CooCustomer[]>([]);
  const [products, setProducts] = useState<CooProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [viewSale, setViewSale] = useState<CooSale | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  // form state
  const [mode, setMode] = useState<'amount' | 'items'>('amount');
  const [amount, setAmount] = useState('');
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState('');
  const [paid, setPaid] = useState(true);
  const [method, setMethod] = useState('momo');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [s, c, p] = await Promise.all([getSales(), getCustomers(), getProducts()]);
    setSales(s); setCustomers(c); setProducts(p); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3200); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sales.filter((s) => s.customer.toLowerCase().includes(q) || s.number.toLowerCase().includes(q)) : sales;
  }, [sales, query]);

  const removeSale = async () => {
    if (!viewSale) return;
    setSaving(true);
    try {
      const res = await deleteSale(viewSale.id);
      setViewSale(null); setConfirmDel(false);
      flash(res.message || 'Sale deleted.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the sale.');
    } finally { setSaving(false); }
  };

  const itemsTotal = products.reduce((sum, p) => sum + (qtys[p.id] || 0) * p.price, 0);

  const reset = () => {
    setMode('amount'); setAmount(''); setQtys({}); setCustomerId('');
    setPaid(true); setMethod('momo'); setError('');
  };

  const step = (id: string, delta: number) =>
    setQtys((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) + delta) }));

  const save = async () => {
    setError('');
    const items = Object.entries(qtys)
      .filter(([, q]) => q > 0)
      .map(([productId, qty]) => ({ productId, qty }));
    if (mode === 'items' && items.length === 0) { setError('Add at least one item, or switch to Enter total.'); return; }
    if (mode === 'amount' && !(parseFloat(amount) > 0)) { setError('Enter how much the sale was.'); return; }
    setSaving(true);
    try {
      const res = await recordSale({
        customerId: customerId || undefined,
        items: mode === 'items' ? items : undefined,
        amount: mode === 'amount' ? parseFloat(amount) : undefined,
        paidNow: paid,
        method,
        dueInDays: 7,
      });
      setOpen(false); reset();
      flash(res.message || 'Sale recorded.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the sale.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="biz">
      <div className="biz__head">
        <div>
          <h1 className="biz__title">Sales</h1>
          <p className="biz__sub">Record what you sell. Your cash, stock and reports update by themselves.</p>
        </div>
        <button className="biz__primary" onClick={() => { reset(); setOpen(true); }}>
          <span className="biz__primary-plus">＋</span> Record a sale
        </button>
      </div>

      <p className="biz__section-label">Recent sales</p>
      {sales.length > 4 && (
        <input className="biz__search" placeholder="Search by customer or number…" value={query} onChange={(e) => setQuery(e.target.value)} />
      )}
      {loading ? (
        <div className="biz__empty">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="biz__list"><div className="biz__empty">{query ? 'No sales match your search.' : 'No sales yet. Tap “Record a sale” to add your first one.'}</div></div>
      ) : (
        <div className="biz__list">
          {filtered.map((s) => (
            <button key={s.id} className="biz__row biz__row--tap" onClick={() => { setViewSale(s); setConfirmDel(false); setError(''); }}>
              <div>
                <div className="biz__row-main">{s.customer}</div>
                <div className="biz__row-sub">
                  {s.number} · {new Date(s.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <div className="biz__row-right">
                <div className="biz__row-amt">{cedis(s.amount)}</div>
                {s.status === 'paid'
                  ? <span className="biz__pill biz__pill--paid">Paid</span>
                  : <span className="biz__pill biz__pill--credit">Owes {cedis(s.outstanding)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <BizSheet title="Record a sale" hint="Fill in what was sold and whether they paid." onClose={() => setOpen(false)}>
          <div className="biz__field">
            <span className="biz__label">How do you want to enter it?</span>
            <div className="biz__seg">
              <button className={`biz__seg-btn${mode === 'amount' ? ' biz__seg-btn--on' : ''}`} onClick={() => setMode('amount')}>Enter total</button>
              <button className={`biz__seg-btn${mode === 'items' ? ' biz__seg-btn--on' : ''}`} onClick={() => setMode('items')}>Pick items</button>
            </div>
          </div>

          {mode === 'amount' ? (
            <div className="biz__field">
              <label className="biz__label" htmlFor="sale-amt">How much was the sale? (GH₵)</label>
              <input id="sale-amt" className="biz__input" type="number" inputMode="decimal" placeholder="0"
                value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
          ) : (
            <div className="biz__field">
              <span className="biz__label">Tap ＋ for each item sold</span>
              {products.length === 0 && <div className="biz__row-sub">No products yet. Add them on the Stock page first.</div>}
              {products.map((p) => (
                <div key={p.id} className="biz__pick">
                  <div>
                    <div className="biz__pick-name">{p.name}</div>
                    <div className="biz__pick-sub">{cedis(p.price)} · {p.stock} {p.unit} left</div>
                  </div>
                  <div className="biz__stepper">
                    <button className="biz__step-btn" onClick={() => step(p.id, -1)} aria-label={`Less ${p.name}`}>−</button>
                    <span className="biz__step-qty">{qtys[p.id] || 0}</span>
                    <button className="biz__step-btn" onClick={() => step(p.id, 1)} aria-label={`More ${p.name}`}>＋</button>
                  </div>
                </div>
              ))}
              <div className="biz__pick-total"><span>Total</span><span>{cedis(itemsTotal)}</span></div>
            </div>
          )}

          <div className="biz__field">
            <label className="biz__label" htmlFor="sale-cust">Who bought it? (optional)</label>
            <select id="sale-cust" className="biz__select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.filter((c) => c.name !== 'Walk-in customer').map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="biz__field">
            <span className="biz__label">Did they pay?</span>
            <div className="biz__seg">
              <button className={`biz__seg-btn${paid ? ' biz__seg-btn--on' : ''}`} onClick={() => setPaid(true)}>Paid now</button>
              <button className={`biz__seg-btn${!paid ? ' biz__seg-btn--on' : ''}`} onClick={() => setPaid(false)}>On credit</button>
            </div>
          </div>

          {paid && (
            <div className="biz__field">
              <span className="biz__label">How did they pay?</span>
              <div className="biz__seg">
                {METHODS.map((m) => (
                  <button key={m.id} className={`biz__seg-btn${method === m.id ? ' biz__seg-btn--on' : ''}`} onClick={() => setMethod(m.id)}>{m.label}</button>
                ))}
              </div>
            </div>
          )}

          {!paid && <p className="biz__row-sub">This will be added to what the customer owes you.</p>}
          {error && <div className="biz__error">{error}</div>}

          <div className="biz__sheet-actions">
            <button className="biz__cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button className="biz__save" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save sale'}</button>
          </div>
        </BizSheet>
      )}

      {viewSale && (
        <BizSheet title={`Sale ${viewSale.number}`} onClose={() => setViewSale(null)}>
          <div className="biz__detail">
            <div className="biz__detail-row"><span>Customer</span><b>{viewSale.customer}</b></div>
            <div className="biz__detail-row"><span>Amount</span><b>{cedis(viewSale.amount)}</b></div>
            <div className="biz__detail-row"><span>Status</span><b>{viewSale.status === 'paid' ? 'Paid' : `Owes ${cedis(viewSale.outstanding)}`}</b></div>
            <div className="biz__detail-row"><span>Date</span><b>{new Date(viewSale.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</b></div>
          </div>
          {error && <div className="biz__error">{error}</div>}
          <div className="biz__sheet-actions">
            <button className="biz__save" onClick={() => setViewSale(null)}>Done</button>
          </div>
          <div className="biz__delete-row">
            {confirmDel ? (
              <>
                <span className="biz__delete-ask">Delete this sale? Stock goes back.</span>
                <button className="biz__link-danger" onClick={removeSale} disabled={saving}>Yes, delete</button>
                <button className="biz__link-muted" onClick={() => setConfirmDel(false)}>Keep</button>
              </>
            ) : (
              <button className="biz__link-danger" onClick={() => setConfirmDel(true)}>Delete this sale</button>
            )}
          </div>
        </BizSheet>
      )}

      {toast && <div className="biz__toast">{toast}</div>}
    </div>
  );
}
