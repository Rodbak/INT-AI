import { useEffect, useMemo, useState } from 'react';
import BizSheet from '../components/BizSheet';
import { SkeletonRows } from '../components/Skeleton';
import TrustBadge from '../components/TrustBadge';
import { cedis } from '../lib/money';
import { getCustomers, addCustomer, updateCustomer, deleteCustomer, recordPayment, type CooCustomer } from '../lib/api';
import './Business.css';

const METHODS = [
  { id: 'momo', label: 'MoMo' },
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank' },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CooCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');

  // add / edit customer
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTrust, setEditingTrust] = useState<CooCustomer['trust']>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  // record-payment form
  const [payFor, setPayFor] = useState<CooCustomer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [method, setMethod] = useState('momo');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => { setCustomers(await getCustomers()); setLoading(false); };
  useEffect(() => { load(); }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3200); };

  const visible = customers.filter((c) => c.name !== 'Walk-in customer');
  const totalOwed = visible.reduce((s, c) => s + c.owed, 0);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? visible.filter((c) => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)) : visible;
  }, [visible, query]);

  const openAdd = () => { setEditingId(null); setEditingTrust(null); setName(''); setPhone(''); setConfirmDel(false); setError(''); setOpen(true); };
  const openEdit = (c: CooCustomer) => { setEditingId(c.id); setEditingTrust(c.trust ?? null); setName(c.name); setPhone(c.phone || ''); setConfirmDel(false); setError(''); setOpen(true); };

  const saveCustomer = async () => {
    setError('');
    if (!name.trim()) { setError('Please enter a name.'); return; }
    setSaving(true);
    try {
      if (editingId) { await updateCustomer(editingId, { name: name.trim(), phone: phone.trim() }); flash('Customer updated.'); }
      else { await addCustomer({ name: name.trim(), phone: phone.trim() || undefined }); flash('Customer added.'); }
      setOpen(false); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save customer.'); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!editingId) return;
    setError(''); setSaving(true);
    try {
      const res = await deleteCustomer(editingId);
      setOpen(false); flash(res.message || 'Customer deleted.'); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete customer.'); setConfirmDel(false); }
    finally { setSaving(false); }
  };

  // Open WhatsApp with a friendly, pre-filled reminder. Formats a Ghana number
  // (leading 0 → +233) so wa.me opens the right chat; no phone → share sheet.
  const remindOnWhatsApp = (c: CooCustomer) => {
    const digits = (c.phone || '').replace(/\D/g, '');
    const intl = digits.startsWith('233') ? digits : digits.startsWith('0') ? `233${digits.slice(1)}` : digits;
    const shop = (() => { try { return localStorage.getItem('int-shop') || 'my shop'; } catch { return 'my shop'; } })();
    const msg = `Hello ${c.name}, this is a friendly reminder that you have a balance of ${cedis(c.owed)} at ${shop}. Whenever you're able, you can pay by MoMo or cash. Thank you! 🙏`;
    const base = intl ? `https://wa.me/${intl}` : 'https://wa.me/';
    window.open(`${base}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const openPay = (c: CooCustomer) => { setPayFor(c); setPayAmount(String(c.owed)); setMethod('momo'); setError(''); };
  const savePayment = async () => {
    if (!payFor) return;
    setError('');
    const amt = parseFloat(payAmount);
    if (!(amt > 0)) { setError('Enter an amount.'); return; }
    setSaving(true);
    try {
      const res = await recordPayment({ customerId: payFor.id, amount: amt, method });
      setPayFor(null); flash(res.message || 'Payment recorded.'); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record payment.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="biz">
      <div className="biz__head">
        <div>
          <h1 className="biz__title">Customers</h1>
          <p className="biz__sub">See who owes you money and record it when they pay.</p>
        </div>
        <button className="biz__primary" onClick={openAdd}>
          <span className="biz__primary-plus">＋</span> Add customer
        </button>
      </div>

      {totalOwed > 0 && (
        <div className="biz__summary">
          <div className="biz__stat">
            <div className="biz__stat-label">Total owed to you</div>
            <div className="biz__stat-value biz__neg">{cedis(totalOwed)}</div>
          </div>
        </div>
      )}

      <p className="biz__section-label">Your customers</p>
      {visible.length > 4 && (
        <input className="biz__search" placeholder="Search by name or phone…" value={query} onChange={(e) => setQuery(e.target.value)} />
      )}
      {loading ? (
        <SkeletonRows />
      ) : filtered.length === 0 ? (
        <div className="biz__list"><div className="biz__empty">{query ? 'No customers match your search.' : 'No customers yet. Add the people you sell to often.'}</div></div>
      ) : (
        <div className="biz__list">
          {filtered.map((c) => (
            <button key={c.id} className="biz__row biz__row--tap" onClick={() => openEdit(c)}>
              <div>
                <div className="biz__row-main">{c.name}</div>
                <div className="biz__row-sub">{c.phone || 'No phone saved'}</div>
                {c.trust && c.trust.band !== 'new' && (
                  <div style={{ marginTop: 6 }}><TrustBadge trust={c.trust} /></div>
                )}
              </div>
              <div className="biz__row-right">
                {c.owed > 0
                  ? <><div className="biz__row-amt biz__neg">Owes {cedis(c.owed)}</div>
                      <div className="biz__row-btns">
                        <span className="biz__mini biz__mini--wa" onClick={(e) => { e.stopPropagation(); remindOnWhatsApp(c); }}>Remind</span>
                        <span className="biz__mini" onClick={(e) => { e.stopPropagation(); openPay(c); }}>Record payment</span>
                      </div></>
                  : <span className="biz__pill biz__pill--paid">Paid up</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <BizSheet title={editingId ? 'Edit customer' : 'Add customer'} hint="Save the people you sell to so you can track who owes you." onClose={() => setOpen(false)}>
          <div className="biz__field">
            <label className="biz__label" htmlFor="cust-name">Name</label>
            <input id="cust-name" className="biz__input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ama Owusu" autoFocus />
          </div>
          <div className="biz__field">
            <label className="biz__label" htmlFor="cust-phone">Phone (optional)</label>
            <input id="cust-phone" className="biz__input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 024 555 0101" />
          </div>
          {editingId && editingTrust && (
            <div className="biz__field">
              <span className="biz__label">How they pay back</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <TrustBadge trust={editingTrust} showScore />
              </div>
              <p className="biz__row-sub">{editingTrust.reason}</p>
            </div>
          )}
          {error && <div className="biz__error">{error}</div>}
          <div className="biz__sheet-actions">
            <button className="biz__cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button className="biz__save" onClick={saveCustomer} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add customer'}</button>
          </div>
          {editingId && (
            <div className="biz__delete-row">
              {confirmDel ? (
                <>
                  <span className="biz__delete-ask">Delete this customer?</span>
                  <button className="biz__link-danger" onClick={remove} disabled={saving}>Yes, delete</button>
                  <button className="biz__link-muted" onClick={() => setConfirmDel(false)}>Keep</button>
                </>
              ) : (
                <button className="biz__link-danger" onClick={() => setConfirmDel(true)}>Delete this customer</button>
              )}
            </div>
          )}
        </BizSheet>
      )}

      {payFor && (
        <BizSheet title={`Payment from ${payFor.name}`} hint="This lowers what they owe you, oldest sale first." onClose={() => setPayFor(null)}>
          <div className="biz__field">
            <label className="biz__label" htmlFor="pay-amt">How much did they pay? (GH₵)</label>
            <input id="pay-amt" className="biz__input" type="number" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus />
            <p className="biz__row-sub" style={{ marginTop: 6 }}>They currently owe {cedis(payFor.owed)}.</p>
          </div>
          <div className="biz__field">
            <span className="biz__label">How did they pay?</span>
            <div className="biz__seg">
              {METHODS.map((m) => (
                <button key={m.id} className={`biz__seg-btn${method === m.id ? ' biz__seg-btn--on' : ''}`} onClick={() => setMethod(m.id)}>{m.label}</button>
              ))}
            </div>
          </div>
          {error && <div className="biz__error">{error}</div>}
          <div className="biz__sheet-actions">
            <button className="biz__cancel" onClick={() => setPayFor(null)}>Cancel</button>
            <button className="biz__save" onClick={savePayment} disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</button>
          </div>
        </BizSheet>
      )}

      {toast && <div className="biz__toast">{toast}</div>}
    </div>
  );
}
