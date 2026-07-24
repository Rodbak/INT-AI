import { useEffect, useRef, useState } from 'react';
import BizSheet from './BizSheet';
import { cedis } from '../lib/money';
import { fileToDataUrl } from '../lib/image';
import { getPurchases, addPurchase, paySupplier, type Purchase } from '../lib/api';

/**
 * Supplier bills on the Money page: record a restock invoice (paid / on credit /
 * part-paid) with an optional photo of the invoice, see what you owe suppliers,
 * and pay bills down later. The paid part is booked as an expense automatically.
 */
export default function SupplierBills({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<Purchase[]>([]);
  const [owed, setOwed] = useState(0);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');

  // form
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState('');
  const [paidNow, setPaidNow] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => getPurchases().then((d) => { setRows(d.purchases); setOwed(d.owed); }).catch(() => {});
  useEffect(() => { load(); }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const openAdd = () => { setSupplier(''); setAmount(''); setPaidNow(''); setNote(''); setPhoto(''); setError(''); setOpen(true); };

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { setPhoto(await fileToDataUrl(f)); } catch { setError('Could not read that photo.'); }
  };

  const setFull = () => setPaidNow(amount);
  const setCredit = () => setPaidNow('0');

  const save = async () => {
    setError('');
    const total = parseFloat(amount);
    if (!(total > 0)) { setError('Enter the bill amount.'); return; }
    const paid = paidNow === '' ? total : Math.max(0, parseFloat(paidNow) || 0);
    setSaving(true);
    try {
      const res = await addPurchase({ supplier: supplier.trim() || 'Supplier', amount: total, amountPaid: paid, note: note.trim() || undefined, photo: photo || undefined });
      setOpen(false); flash(res.message); load(); onChange?.();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the bill.'); }
    finally { setSaving(false); }
  };

  const payOff = async (p: Purchase) => {
    try { const r = await paySupplier(p.id); flash(r.message); load(); onChange?.(); }
    catch (e) { flash(e instanceof Error ? e.message : 'Could not record payment.'); }
  };

  const statusPill = (p: Purchase) =>
    p.status === 'paid' ? <span className="biz__pill biz__pill--paid">Paid</span>
      : <span className="biz__pill biz__pill--credit">Owes {cedis(p.outstanding)}</span>;

  return (
    <div style={{ marginTop: 6 }}>
      <div className="biz__head" style={{ marginBottom: 12 }}>
        <div>
          <p className="biz__section-label" style={{ margin: 0 }}>Supplier bills</p>
          {owed > 0 && <div className="biz__row-sub">You owe suppliers {cedis(owed)}</div>}
        </div>
        <button className="biz__primary biz__primary--ghost" onClick={openAdd}>
          <span className="biz__primary-plus">＋</span> Supplier bill
        </button>
      </div>

      {rows.length > 0 && (
        <div className="biz__list" style={{ marginBottom: 22 }}>
          {rows.map((p) => (
            <div key={p.id} className="biz__row">
              <div>
                <div className="biz__row-main">{p.supplier}</div>
                <div className="biz__row-sub">
                  {p.note ? `${p.note} · ` : ''}{new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {p.hasPhoto ? ' · 📎 invoice' : ''}
                </div>
              </div>
              <div className="biz__row-right">
                <div className="biz__row-amt">{cedis(p.amount)}</div>
                <div className="biz__row-btns">
                  {statusPill(p)}
                  {p.outstanding > 0 && <span className="biz__mini" onClick={() => payOff(p)}>Pay</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <BizSheet title="Record a supplier bill" hint="What you bought to restock — mark it paid, on credit, or part-paid." onClose={() => setOpen(false)}>
          <div className="biz__field">
            <label className="biz__label" htmlFor="sb-supplier">Supplier</label>
            <input id="sb-supplier" className="biz__input" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Melcom / Kofi Wholesale" autoFocus />
          </div>
          <div className="biz__field">
            <label className="biz__label" htmlFor="sb-amt">Bill total (GH₵)</label>
            <input id="sb-amt" className="biz__input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="biz__field">
            <label className="biz__label" htmlFor="sb-paid">How much did you pay now? (GH₵)</label>
            <input id="sb-paid" className="biz__input" type="number" inputMode="decimal" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} placeholder={amount || '0'} />
            <div className="biz__seg" style={{ marginTop: 8 }}>
              <button className="biz__seg-btn" onClick={setFull}>Paid in full</button>
              <button className="biz__seg-btn" onClick={setCredit}>All on credit</button>
            </div>
          </div>
          <div className="biz__field">
            <label className="biz__label" htmlFor="sb-note">Note (optional)</label>
            <input id="sb-note" className="biz__input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. rice & oil delivery" />
          </div>
          <div className="biz__field">
            <span className="biz__label">Invoice photo (optional)</span>
            {photo
              ? <div className="sb__photo"><img src={photo} alt="Invoice" /><button className="biz__link-muted" onClick={() => setPhoto('')}>Remove</button></div>
              : <button className="biz__primary biz__primary--ghost" onClick={() => fileRef.current?.click()}>📷 Add invoice photo</button>}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={pickPhoto} />
          </div>
          {error && <div className="biz__error">{error}</div>}
          <div className="biz__sheet-actions">
            <button className="biz__cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button className="biz__save" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save bill'}</button>
          </div>
        </BizSheet>
      )}

      {toast && <div className="biz__toast">{toast}</div>}
    </div>
  );
}
