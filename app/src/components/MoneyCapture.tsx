import { useState } from 'react';
import BizSheet from './BizSheet';
import { parseMoneyMessage, recordPayment, recordSale, recordExpense, getCustomers, type ParsedMoney, type CooCustomer } from '../lib/api';
import { cedis } from '../lib/money';

const CATEGORIES = ['Restock / buying stock', 'Rent', 'Transport', 'Salaries', 'Utilities (light, water)', 'Airtime / data', 'Other'];

/**
 * Paste a MoMo / bank message; INT reads it and proposes the right record.
 * Money IN is never auto-filed — INT asks whether it's a debt payment, a sale,
 * or other cash-in (money taken at the till is already a cash-in and doesn't
 * come through here). Money OUT is proposed as an expense with a suggested
 * category to confirm. On confirm we reuse the normal record endpoints.
 */
export default function MoneyCapture({ onDone }: { onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedMoney | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // editable proposal
  const [amount, setAmount] = useState('');
  const [dir, setDir] = useState<'in' | 'out'>('in');
  const [inKind, setInKind] = useState<'debt' | 'sale' | 'other'>('other');
  const [customerId, setCustomerId] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [customers, setCustomers] = useState<CooCustomer[]>([]);

  const openSheet = () => { setText(''); setParsed(null); setError(''); setOpen(true); };

  const doParse = async () => {
    if (!text.trim()) { setError('Paste the message first.'); return; }
    setBusy(true); setError('');
    try {
      const p = await parseMoneyMessage(text.trim());
      setParsed(p);
      setAmount(p.amount != null ? String(p.amount) : '');
      const d: 'in' | 'out' = p.direction === 'out' ? 'out' : 'in';
      setDir(d);
      if (d === 'in') {
        setInKind(p.matchedCustomerId ? 'debt' : 'other');
        setCustomerId(p.matchedCustomerId || '');
        if (customers.length === 0) getCustomers().then(setCustomers).catch(() => {});
      } else {
        setCategory(p.category && CATEGORIES.includes(p.category) ? p.category : CATEGORIES[0]);
        setNote([p.counterparty, p.reference].filter(Boolean).join(' · '));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that message.');
    } finally {
      setBusy(false);
    }
  };

  const pickInKind = (k: 'debt' | 'sale' | 'other') => {
    setInKind(k);
    if ((k === 'debt' || k === 'sale') && customers.length === 0) getCustomers().then(setCustomers).catch(() => {});
  };

  const confirm = async () => {
    const amt = parseFloat(amount);
    if (!(amt > 0)) { setError('Enter the amount.'); return; }
    setSaving(true); setError('');
    try {
      let message = '';
      if (dir === 'out') {
        message = (await recordExpense({ category, amount: amt, note: note.trim() || undefined })).message;
      } else if (inKind === 'debt') {
        if (!customerId) { setError('Choose the customer who paid.'); setSaving(false); return; }
        message = (await recordPayment({ customerId, amount: amt, method: 'momo' })).message;
      } else if (inKind === 'sale') {
        message = (await recordSale({ amount: amt, paidNow: true, method: 'momo', customerId: customerId || undefined })).message;
      } else {
        message = (await recordPayment({ amount: amt, method: 'momo' })).message;
      }
      setOpen(false);
      onDone(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record it.');
    } finally {
      setSaving(false);
    }
  };

  const debtors = customers.filter((c) => c.name !== 'Walk-in customer');

  return (
    <>
      <button className="biz__primary biz__primary--ghost" onClick={openSheet}>
        <span className="biz__primary-plus">📩</span> From a MoMo message
      </button>

      {open && (
        <BizSheet
          title={parsed ? 'Is this right?' : 'Paste a MoMo or bank message'}
          hint={parsed ? 'INT read your message. Check it, then save.' : 'Copy the SMS from MTN / Telecel / AirtelTigo or your bank and paste it here.'}
          onClose={() => setOpen(false)}
        >
          {!parsed ? (
            <>
              <textarea
                className="biz__input"
                rows={5}
                placeholder="e.g. Payment received for GHS 50.00 from KWAME MENSAH 0241234567…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
              {error && <div className="biz__error">{error}</div>}
              <div className="biz__sheet-actions">
                <button className="biz__cancel" onClick={() => setOpen(false)}>Cancel</button>
                <button className="biz__save" onClick={doParse} disabled={busy}>{busy ? 'Reading…' : 'Read it'}</button>
              </div>
            </>
          ) : (
            <>
              {/* Direction */}
              <div className="biz__field">
                <span className="biz__label">Money direction</span>
                <div className="biz__seg">
                  <button className={`biz__seg-btn${dir === 'in' ? ' biz__seg-btn--on' : ''}`} onClick={() => setDir('in')}>Money in</button>
                  <button className={`biz__seg-btn${dir === 'out' ? ' biz__seg-btn--on' : ''}`} onClick={() => setDir('out')}>Money out</button>
                </div>
              </div>

              {/* Amount */}
              <div className="biz__field">
                <label className="biz__label" htmlFor="mc-amt">Amount (GH₵)</label>
                <input id="mc-amt" className="biz__input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>

              {dir === 'in' ? (
                <>
                  <div className="biz__field">
                    <span className="biz__label">What was this money?</span>
                    <div className="biz__seg">
                      <button className={`biz__seg-btn${inKind === 'debt' ? ' biz__seg-btn--on' : ''}`} onClick={() => pickInKind('debt')}>Paid a debt</button>
                      <button className={`biz__seg-btn${inKind === 'sale' ? ' biz__seg-btn--on' : ''}`} onClick={() => pickInKind('sale')}>A sale</button>
                      <button className={`biz__seg-btn${inKind === 'other' ? ' biz__seg-btn--on' : ''}`} onClick={() => pickInKind('other')}>Other</button>
                    </div>
                  </div>
                  {parsed.matchedCustomerName && inKind === 'debt' && (
                    <p className="biz__row-sub" style={{ marginBottom: 12 }}>
                      Looks like <b>{parsed.matchedCustomerName}</b>{parsed.matchedOwed > 0 ? ` (owes ${cedis(parsed.matchedOwed)})` : ''}.
                    </p>
                  )}
                  {(inKind === 'debt' || inKind === 'sale') && (
                    <div className="biz__field">
                      <label className="biz__label" htmlFor="mc-cust">{inKind === 'debt' ? 'Who paid?' : 'Who bought it? (optional)'}</label>
                      <select id="mc-cust" className="biz__select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                        <option value="">{inKind === 'debt' ? 'Choose a customer…' : 'Walk-in customer'}</option>
                        {debtors.map((c) => <option key={c.id} value={c.id}>{c.name}{c.owed > 0 ? ` — owes ${cedis(c.owed)}` : ''}</option>)}
                      </select>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="biz__field">
                    <label className="biz__label" htmlFor="mc-cat">What was it for?</label>
                    <select id="mc-cat" className="biz__select" value={category} onChange={(e) => setCategory(e.target.value)}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="biz__field">
                    <label className="biz__label" htmlFor="mc-note">Note (optional)</label>
                    <input id="mc-note" className="biz__input" value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                </>
              )}

              {error && <div className="biz__error">{error}</div>}
              <div className="biz__sheet-actions">
                <button className="biz__cancel" onClick={() => setParsed(null)}>Back</button>
                <button className="biz__save" onClick={confirm} disabled={saving}>{saving ? 'Saving…' : 'Save it'}</button>
              </div>
            </>
          )}
        </BizSheet>
      )}
    </>
  );
}
