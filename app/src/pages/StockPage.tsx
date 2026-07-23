import { useEffect, useMemo, useState } from 'react';
import BizSheet from '../components/BizSheet';
import { SkeletonRows } from '../components/Skeleton';
import { cedis } from '../lib/money';
import { getProducts, addProduct, updateProduct, deleteProduct, type CooProduct } from '../lib/api';
import './Business.css';

const empty = { name: '', unit: 'unit', price: '', cost: '', stock: '', reorder: '' };

export default function StockPage() {
  const [products, setProducts] = useState<CooProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');

  // add / edit product form
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [confirmDel, setConfirmDel] = useState(false);

  // restock form
  const [restockFor, setRestockFor] = useState<CooProduct | null>(null);
  const [addQty, setAddQty] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => { setProducts(await getProducts()); setLoading(false); };
  useEffect(() => { load(); }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3200); };
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const lowCount = products.filter((p) => p.low).length;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, query]);

  const openAdd = () => { setEditingId(null); setForm({ ...empty }); setConfirmDel(false); setError(''); setOpen(true); };
  const openEdit = (p: CooProduct) => {
    setEditingId(p.id);
    setForm({ name: p.name, unit: p.unit, price: String(p.price), cost: String(p.cost), stock: String(p.stock), reorder: String(p.reorderPoint) });
    setConfirmDel(false); setError(''); setOpen(true);
  };

  const save = async () => {
    setError('');
    if (!form.name.trim()) { setError('Please enter a product name.'); return; }
    if (!(parseFloat(form.price) >= 0) || !(parseFloat(form.cost) >= 0)) { setError('Enter the selling price and what it costs you.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), unit: form.unit.trim() || 'unit',
        price: parseFloat(form.price), cost: parseFloat(form.cost),
        stock: parseInt(form.stock) || 0, reorderPoint: parseInt(form.reorder) || 0,
      };
      if (editingId) { await updateProduct(editingId, payload); flash('Product updated.'); }
      else { await addProduct(payload); flash('Product added.'); }
      setOpen(false); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save product.'); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!editingId) return;
    setError(''); setSaving(true);
    try {
      const res = await deleteProduct(editingId);
      setOpen(false); flash(res.message || 'Product deleted.'); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete product.'); setConfirmDel(false); }
    finally { setSaving(false); }
  };

  const saveRestock = async () => {
    if (!restockFor) return;
    setError('');
    const n = parseInt(addQty);
    if (!(n > 0)) { setError('Enter how many you added.'); return; }
    setSaving(true);
    try {
      await updateProduct(restockFor.id, { addStock: n });
      setRestockFor(null); setAddQty('');
      flash(`Added ${n} ${restockFor.unit} to ${restockFor.name}.`);
      load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update stock.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="biz">
      <div className="biz__head">
        <div>
          <h1 className="biz__title">Stock</h1>
          <p className="biz__sub">Keep track of what you have. INT warns you before you run out.</p>
        </div>
        <button className="biz__primary" onClick={openAdd}>
          <span className="biz__primary-plus">＋</span> Add product
        </button>
      </div>

      {lowCount > 0 && (
        <div className="biz__summary">
          <div className="biz__stat">
            <div className="biz__stat-label">Running low</div>
            <div className="biz__stat-value biz__neg">{lowCount} item{lowCount === 1 ? '' : 's'}</div>
          </div>
        </div>
      )}

      <p className="biz__section-label">Your products</p>
      {products.length > 4 && (
        <input className="biz__search" placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} />
      )}
      {loading ? (
        <SkeletonRows />
      ) : filtered.length === 0 ? (
        <div className="biz__list"><div className="biz__empty">{query ? 'No products match your search.' : 'No products yet. Add the things you sell to track stock.'}</div></div>
      ) : (
        <div className="biz__list">
          {filtered.map((p) => (
            <button key={p.id} className="biz__row biz__row--tap" onClick={() => openEdit(p)}>
              <div>
                <div className="biz__row-main">{p.name}</div>
                <div className="biz__row-sub">Selling at {cedis(p.price)} · warns at {p.reorderPoint} {p.unit}</div>
              </div>
              <div className="biz__row-right">
                <div className="biz__row-amt">
                  {p.stock} {p.unit}{p.low && <> <span className="biz__pill biz__pill--low">Low</span></>}
                </div>
                <span className="biz__mini" onClick={(e) => { e.stopPropagation(); setRestockFor(p); setAddQty(''); setError(''); }}>Add stock</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <BizSheet title={editingId ? 'Edit product' : 'Add product'} hint="Tell INT what you sell so it can track stock and profit." onClose={() => setOpen(false)}>
          <div className="biz__field">
            <label className="biz__label" htmlFor="p-name">Product name</label>
            <input id="p-name" className="biz__input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Rice (25kg)" autoFocus />
          </div>
          <div className="biz__field">
            <label className="biz__label" htmlFor="p-unit">Sold in (unit)</label>
            <input id="p-unit" className="biz__input" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="e.g. bag, carton, bottle" />
          </div>
          <div className="biz__field">
            <label className="biz__label" htmlFor="p-price">Selling price — what a customer pays (GH₵)</label>
            <input id="p-price" className="biz__input" type="number" inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="0" />
          </div>
          <div className="biz__field">
            <label className="biz__label" htmlFor="p-cost">Cost price — what it costs you (GH₵)</label>
            <input id="p-cost" className="biz__input" type="number" inputMode="decimal" value={form.cost} onChange={(e) => set('cost', e.target.value)} placeholder="0" />
          </div>
          <div className="biz__field">
            <label className="biz__label" htmlFor="p-stock">How many do you have now?</label>
            <input id="p-stock" className="biz__input" type="number" inputMode="numeric" value={form.stock} onChange={(e) => set('stock', e.target.value)} placeholder="0" />
          </div>
          <div className="biz__field">
            <label className="biz__label" htmlFor="p-reorder">Warn me when it drops to</label>
            <input id="p-reorder" className="biz__input" type="number" inputMode="numeric" value={form.reorder} onChange={(e) => set('reorder', e.target.value)} placeholder="e.g. 5" />
          </div>
          {error && <div className="biz__error">{error}</div>}
          <div className="biz__sheet-actions">
            <button className="biz__cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button className="biz__save" onClick={save} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add product'}</button>
          </div>
          {editingId && (
            <div className="biz__delete-row">
              {confirmDel ? (
                <>
                  <span className="biz__delete-ask">Delete this product?</span>
                  <button className="biz__link-danger" onClick={remove} disabled={saving}>Yes, delete</button>
                  <button className="biz__link-muted" onClick={() => setConfirmDel(false)}>Keep</button>
                </>
              ) : (
                <button className="biz__link-danger" onClick={() => setConfirmDel(true)}>Delete this product</button>
              )}
            </div>
          )}
        </BizSheet>
      )}

      {restockFor && (
        <BizSheet title={`Add stock — ${restockFor.name}`} hint="Enter how many you just received." onClose={() => setRestockFor(null)}>
          <div className="biz__field">
            <label className="biz__label" htmlFor="r-qty">How many {restockFor.unit}s did you add?</label>
            <input id="r-qty" className="biz__input" type="number" inputMode="numeric" value={addQty} onChange={(e) => setAddQty(e.target.value)} placeholder="0" autoFocus />
            <p className="biz__row-sub" style={{ marginTop: 6 }}>You currently have {restockFor.stock} {restockFor.unit}.</p>
          </div>
          {error && <div className="biz__error">{error}</div>}
          <div className="biz__sheet-actions">
            <button className="biz__cancel" onClick={() => setRestockFor(null)}>Cancel</button>
            <button className="biz__save" onClick={saveRestock} disabled={saving}>{saving ? 'Saving…' : 'Add stock'}</button>
          </div>
        </BizSheet>
      )}

      {toast && <div className="biz__toast">{toast}</div>}
    </div>
  );
}
