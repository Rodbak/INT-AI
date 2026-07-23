import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BizSheet from '../components/BizSheet';
import {
  getSettings, saveSettings, listCashiers, createCashier, updateCashier, deleteCashier,
  type PosSettings, type PosCashier, type TaxRate,
} from '../lib/pos';
import './Business.css';
import './TillSetup.css';

const GHANA_PRESET: TaxRate[] = [
  { name: 'VAT', rate: 15 },
  { name: 'NHIL', rate: 2.5 },
  { name: 'GETFund', rate: 2.5 },
  { name: 'COVID', rate: 1 },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`ts__toggle${on ? ' ts__toggle--on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="ts__knob" />
    </button>
  );
}

export default function TillSetupPage() {
  const navigate = useNavigate();
  const [s, setS] = useState<PosSettings | null>(null);
  const [cashiers, setCashiers] = useState<PosCashier[]>([]);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  // cashier sheet
  const [sheet, setSheet] = useState<null | { id?: string; name: string; pin: string }>(null);
  const [error, setError] = useState('');

  const load = async () => {
    const [{ settings }, { cashiers: cs }] = await Promise.all([getSettings(), listCashiers()]);
    setS(settings); setCashiers(cs);
  };
  useEffect(() => { load().catch(() => {}); }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  if (!s) return <div className="biz"><div className="biz__empty">Loading…</div></div>;

  const patch = (p: Partial<PosSettings>) => setS({ ...s, ...p });
  const rates = s.taxRates || [];
  const setRate = (i: number, k: keyof TaxRate, v: string) =>
    patch({ taxRates: rates.map((r, idx) => (idx === i ? { ...r, [k]: k === 'rate' ? parseFloat(v) || 0 : v } : r)) });

  const save = async () => {
    setSaving(true);
    try { const { settings } = await saveSettings(s); setS(settings); flash('Settings saved.'); }
    catch (e) { flash(e instanceof Error ? e.message : 'Could not save'); }
    finally { setSaving(false); }
  };

  const saveCashier = async () => {
    if (!sheet) return;
    setError('');
    if (!sheet.name.trim()) { setError('Enter a name.'); return; }
    try {
      if (sheet.id) {
        await updateCashier(sheet.id, { name: sheet.name.trim(), ...(sheet.pin ? { pin: sheet.pin } : {}) });
        flash('Cashier updated.');
      } else {
        if (!/^\d{4,6}$/.test(sheet.pin)) { setError('PIN must be 4–6 digits.'); return; }
        await createCashier(sheet.name.trim(), sheet.pin);
        flash('Cashier added.');
      }
      setSheet(null);
      listCashiers().then(({ cashiers: cs }) => setCashiers(cs));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save cashier'); }
  };

  const removeCashier = async (id: string) => {
    await deleteCashier(id).catch(() => {});
    listCashiers().then(({ cashiers: cs }) => setCashiers(cs));
    flash('Cashier removed.');
  };

  return (
    <div className="biz">
      <div className="biz__head">
        <div>
          <h1 className="biz__title">Till setup</h1>
          <p className="biz__sub">Set up your point-of-sale: cashiers, hardware, tax and receipts.</p>
        </div>
        <button className="biz__primary" onClick={() => navigate('/pos')}>Open Till →</button>
      </div>

      {/* Cashiers */}
      <p className="biz__section-label">Cashiers</p>
      <div className="biz__list">
        {cashiers.length === 0 && <div className="biz__empty">Add at least one cashier so staff can sign in to the till.</div>}
        {cashiers.map((c) => (
          <div key={c.id} className="biz__row">
            <div className="biz__row-main">{c.name}{c.active === false && <span className="biz__muted"> · inactive</span>}</div>
            <div className="ts__row-actions">
              <button className="biz__mini" onClick={() => { setError(''); setSheet({ id: c.id, name: c.name, pin: '' }); }}>Edit</button>
              <button className="ts__remove" onClick={() => removeCashier(c.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <button className="ts__add" onClick={() => { setError(''); setSheet({ name: '', pin: '' }); }}>＋ Add cashier</button>

      {/* Hardware */}
      <p className="biz__section-label">Hardware at the counter</p>
      <div className="ts__card">
        <div className="ts__opt">
          <div><div className="ts__opt-name">Barcode scanner</div><div className="ts__opt-sub">Scan items to add them to the sale.</div></div>
          <Toggle on={s.barcodeEnabled} onChange={(v) => patch({ barcodeEnabled: v })} />
        </div>
        <div className="ts__opt">
          <div><div className="ts__opt-name">Receipt printer</div><div className="ts__opt-sub">Show a Print button on receipts.</div></div>
          <Toggle on={s.printerEnabled} onChange={(v) => patch({ printerEnabled: v })} />
        </div>
        <div className="ts__opt">
          <div><div className="ts__opt-name">Cash drawer</div><div className="ts__opt-sub">Pop the drawer on cash sales (via the printer).</div></div>
          <Toggle on={s.cashDrawer} onChange={(v) => patch({ cashDrawer: v })} />
        </div>
      </div>

      {/* Tax */}
      <p className="biz__section-label">Tax &amp; levies</p>
      <div className="ts__card">
        <div className="ts__opt">
          <div><div className="ts__opt-name">Charge tax on sales</div><div className="ts__opt-sub">Turn on if your business is VAT-registered.</div></div>
          <Toggle on={s.taxEnabled} onChange={(v) => patch({ taxEnabled: v, taxRates: v && rates.length === 0 ? GHANA_PRESET : rates })} />
        </div>
        {s.taxEnabled && (
          <>
            {rates.map((r, i) => (
              <div key={i} className="ts__rate">
                <input className="ts__rate-name" value={r.name} onChange={(e) => setRate(i, 'name', e.target.value)} placeholder="e.g. VAT" />
                <input className="ts__rate-pct" type="number" inputMode="decimal" value={r.rate} onChange={(e) => setRate(i, 'rate', e.target.value)} />
                <span className="ts__pct">%</span>
                <button className="ts__remove" onClick={() => patch({ taxRates: rates.filter((_, idx) => idx !== i) })}>✕</button>
              </div>
            ))}
            <div className="ts__rate-actions">
              <button className="ts__add ts__add--sm" onClick={() => patch({ taxRates: [...rates, { name: '', rate: 0 }] })}>＋ Add rate</button>
              <label className="ts__inline"><input type="checkbox" checked={s.taxInclusive} onChange={(e) => patch({ taxInclusive: e.target.checked })} /> Prices already include tax</label>
            </div>
          </>
        )}
      </div>

      {/* Receipt */}
      <p className="biz__section-label">Receipt</p>
      <div className="ts__card">
        <label className="ts__label">Top of receipt (address, phone…)</label>
        <input className="ts__input" value={s.receiptHeader || ''} onChange={(e) => patch({ receiptHeader: e.target.value })} placeholder="e.g. Kaneshie Market · 024 000 0000" />
        <label className="ts__label">Bottom of receipt</label>
        <input className="ts__input" value={s.receiptFooter || ''} onChange={(e) => patch({ receiptFooter: e.target.value })} placeholder="e.g. Thank you! Come again." />
      </div>

      <button className="biz__primary ts__save" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>

      {sheet && (
        <BizSheet title={sheet.id ? 'Edit cashier' : 'Add cashier'} hint={sheet.id ? 'Leave PIN blank to keep the current one.' : 'They will sign in with this PIN.'} onClose={() => setSheet(null)}>
          <div className="biz__field">
            <label className="biz__label" htmlFor="cn">Name</label>
            <input id="cn" className="biz__input" value={sheet.name} onChange={(e) => setSheet({ ...sheet, name: e.target.value })} placeholder="e.g. Akosua" autoFocus />
          </div>
          <div className="biz__field">
            <label className="biz__label" htmlFor="cp">PIN (4–6 digits)</label>
            <input id="cp" className="biz__input" type="tel" inputMode="numeric" maxLength={6} value={sheet.pin} onChange={(e) => setSheet({ ...sheet, pin: e.target.value.replace(/\D/g, '') })} placeholder={sheet.id ? '••••' : '1234'} />
          </div>
          {error && <div className="biz__error">{error}</div>}
          <div className="biz__sheet-actions">
            <button className="biz__cancel" onClick={() => setSheet(null)}>Cancel</button>
            <button className="biz__save" onClick={saveCashier}>{sheet.id ? 'Save' : 'Add cashier'}</button>
          </div>
        </BizSheet>
      )}

      {toast && <div className="biz__toast">{toast}</div>}
    </div>
  );
}
