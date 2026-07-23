import { useEffect, useRef, useState } from 'react';
import { getVisionAvailable, scanStockPhoto, bulkAddProducts, type ScannedItem } from '../lib/api';
import { fileToDataUrl } from '../lib/image';
import BizSheet from './BizSheet';

/**
 * "Scan a photo" flow on the Stock page: take/pick a photo of a shelf, delivery
 * or invoice; INT reads it and proposes items; the owner edits and confirms.
 * Hidden entirely when no model key is configured.
 */
export default function StockScan({ onDone }: { onDone: (msg: string) => void }) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ScannedItem[] | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { getVisionAvailable().then(setAvailable); }, []);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setBusy(true); setError('');
    try {
      const dataUrl = await fileToDataUrl(file);
      const found = await scanStockPhoto(dataUrl);
      if (found.length === 0) { setError("INT didn't spot any products. Try a closer, clearer photo."); }
      else setItems(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "INT couldn't read that photo.");
    } finally {
      setBusy(false);
    }
  };

  const edit = (i: number, patch: Partial<ScannedItem>) =>
    setItems((prev) => prev ? prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) : prev);
  const removeRow = (i: number) => setItems((prev) => prev ? prev.filter((_, idx) => idx !== i) : prev);

  const saveAll = async () => {
    if (!items || items.length === 0) return;
    setSaving(true); setError('');
    try {
      const res = await bulkAddProducts(items.filter((it) => it.name.trim() && it.qty >= 0));
      setItems(null);
      onDone(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!available) return null;

  return (
    <>
      <button className="biz__primary biz__primary--ghost" onClick={pick} disabled={busy}>
        <span className="biz__primary-plus">📷</span> {busy ? 'Reading photo…' : 'Scan a photo'}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />

      {(items || error) && (
        <BizSheet
          title={items ? 'INT found these' : 'Scan a photo'}
          hint={items ? 'Check the list, fix anything, then add it to your stock.' : undefined}
          onClose={() => { setItems(null); setError(''); }}
        >
          {error && <div className="biz__error" style={{ marginBottom: 12 }}>{error}</div>}
          {items && (
            <>
              {items.length === 0 && <div className="biz__empty">Nothing to add.</div>}
              {items.map((it, i) => (
                <div key={i} className="scan__row">
                  <input
                    className="biz__input scan__name"
                    value={it.name}
                    onChange={(e) => edit(i, { name: e.target.value })}
                    placeholder="Product name"
                  />
                  <input
                    className="biz__input scan__qty"
                    type="number"
                    inputMode="numeric"
                    value={it.qty}
                    onChange={(e) => edit(i, { qty: Math.max(0, parseInt(e.target.value) || 0) })}
                    aria-label="Quantity"
                  />
                  <button className="scan__x" onClick={() => removeRow(i)} aria-label="Remove">×</button>
                </div>
              ))}
              <div className="biz__sheet-actions">
                <button className="biz__cancel" onClick={() => { setItems(null); setError(''); }}>Cancel</button>
                <button className="biz__save" onClick={saveAll} disabled={saving || items.length === 0}>
                  {saving ? 'Adding…' : `Add ${items.length} to stock`}
                </button>
              </div>
            </>
          )}
        </BizSheet>
      )}
    </>
  );
}
