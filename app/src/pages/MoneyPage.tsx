import { useEffect, useState } from 'react';
import BizSheet from '../components/BizSheet';
import { cedis } from '../lib/money';
import { getExpenses, recordExpense, updateExpense, deleteExpense, getCooBrief, type CooExpense } from '../lib/api';
import './Business.css';

const CATEGORIES = ['Restock / buying stock', 'Rent', 'Transport', 'Salaries', 'Utilities (light, water)', 'Airtime / data', 'Other'];

export default function MoneyPage() {
  const [expenses, setExpenses] = useState<CooExpense[]>([]);
  const [cash, setCash] = useState<number | null>(null);
  const [runway, setRunway] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [ex, brief] = await Promise.all([getExpenses(), getCooBrief().catch(() => null)]);
    setExpenses(ex);
    if (brief && !brief.empty) { setCash(brief.cashOnHand); setRunway(brief.cashRunwayWeeks); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3200); };

  const openAdd = () => { setEditingId(null); setAmount(''); setCategory(CATEGORIES[0]); setNote(''); setConfirmDel(false); setError(''); setOpen(true); };
  const openEdit = (e: CooExpense) => {
    setEditingId(e.id); setAmount(String(e.amount));
    setCategory(e.category); // keep whatever it was, even if not a preset
    setNote(e.note || ''); setConfirmDel(false); setError(''); setOpen(true);
  };

  // Include the current category in the dropdown even if it isn't a preset,
  // so editing an older record never silently changes its category.
  const categoryOptions = CATEGORIES.includes(category) ? CATEGORIES : [category, ...CATEGORIES];

  const save = async () => {
    setError('');
    const amt = parseFloat(amount);
    if (!(amt > 0)) { setError('Enter how much you spent.'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateExpense(editingId, { category, amount: amt, note: note.trim() });
        flash('Expense updated.');
      } else {
        const res = await recordExpense({ category, amount: amt, note: note.trim() || undefined });
        flash(res.message || 'Expense recorded.');
      }
      setOpen(false); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save expense.'); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await deleteExpense(editingId);
      setOpen(false); flash(res.message || 'Expense deleted.'); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete expense.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="biz">
      <div className="biz__head">
        <div>
          <h1 className="biz__title">Money</h1>
          <p className="biz__sub">Record money you spend so your cash figure stays right.</p>
        </div>
        <button className="biz__primary" onClick={openAdd}>
          <span className="biz__primary-plus">＋</span> Record an expense
        </button>
      </div>

      <div className="biz__summary">
        <div className="biz__stat">
          <div className="biz__stat-label">Cash on hand</div>
          <div className="biz__stat-value">{cash == null ? '—' : cedis(cash)}</div>
        </div>
        {runway != null && (
          <div className="biz__stat">
            <div className="biz__stat-label">That lasts about</div>
            <div className="biz__stat-value">{runway} week{runway === 1 ? '' : 's'}</div>
          </div>
        )}
      </div>

      <p className="biz__section-label">Recent expenses</p>
      {loading ? (
        <div className="biz__empty">Loading…</div>
      ) : expenses.length === 0 ? (
        <div className="biz__list"><div className="biz__empty">No expenses yet. Record what you spend to keep your cash accurate.</div></div>
      ) : (
        <div className="biz__list">
          {expenses.map((e) => (
            <button key={e.id} className="biz__row biz__row--tap" onClick={() => openEdit(e)}>
              <div>
                <div className="biz__row-main">{e.category}</div>
                <div className="biz__row-sub">
                  {e.note ? `${e.note} · ` : ''}{new Date(e.spentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <div className="biz__row-amt biz__neg">− {cedis(e.amount)}</div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <BizSheet title={editingId ? 'Edit expense' : 'Record an expense'} hint="Money you paid out — rent, stock, transport, and so on." onClose={() => setOpen(false)}>
          <div className="biz__field">
            <label className="biz__label" htmlFor="e-amt">How much did you spend? (GH₵)</label>
            <input id="e-amt" className="biz__input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
          </div>
          <div className="biz__field">
            <label className="biz__label" htmlFor="e-cat">What was it for?</label>
            <select id="e-cat" className="biz__select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="biz__field">
            <label className="biz__label" htmlFor="e-note">Note (optional)</label>
            <input id="e-note" className="biz__input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paid the landlord" />
          </div>
          {error && <div className="biz__error">{error}</div>}
          <div className="biz__sheet-actions">
            <button className="biz__cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button className="biz__save" onClick={save} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save expense'}</button>
          </div>
          {editingId && (
            <div className="biz__delete-row">
              {confirmDel ? (
                <>
                  <span className="biz__delete-ask">Delete this expense?</span>
                  <button className="biz__link-danger" onClick={remove} disabled={saving}>Yes, delete</button>
                  <button className="biz__link-muted" onClick={() => setConfirmDel(false)}>Keep</button>
                </>
              ) : (
                <button className="biz__link-danger" onClick={() => setConfirmDel(true)}>Delete this expense</button>
              )}
            </div>
          )}
        </BizSheet>
      )}

      {toast && <div className="biz__toast">{toast}</div>}
    </div>
  );
}
