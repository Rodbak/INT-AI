import { useEffect, useState } from 'react';
import { loginCashier, openShift, type PosCashier } from '../../lib/pos';

interface Props {
  shopName: string;
  cashiers: PosCashier[];
  onStarted: (session: { cashierId: string; cashierName: string; shiftId: string }) => void;
  onExit: () => void;
}

/** Pick a cashier, enter PIN, set the opening cash float → opens a shift. */
export default function CashierLogin({ shopName, cashiers, onStarted, onExit }: Props) {
  const [picked, setPicked] = useState<PosCashier | null>(cashiers.length === 1 ? cashiers[0] : null);
  const [pin, setPin] = useState('');
  const [float, setFloat] = useState('');
  const [step, setStep] = useState<'pin' | 'float'>('pin');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setPin(''); setError(''); setStep('pin'); }, [picked]);

  const key = (d: string) => {
    setError('');
    if (d === 'del') return setPin((p) => p.slice(0, -1));
    if (pin.length >= 6) return;
    setPin((p) => p + d);
  };

  const verifyPin = async () => {
    if (!picked) return;
    setBusy(true); setError('');
    try {
      await loginCashier(picked.id, pin);
      setStep('float');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wrong PIN');
      setPin('');
    } finally { setBusy(false); }
  };

  const start = async () => {
    if (!picked) return;
    setBusy(true); setError('');
    try {
      const { shift } = await openShift(picked.id, parseFloat(float) || 0);
      onStarted({ cashierId: picked.id, cashierName: picked.name, shiftId: shift.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the till');
    } finally { setBusy(false); }
  };

  return (
    <div className="till-gate">
      <button className="till-gate__exit" onClick={onExit}>← Dashboard</button>
      <div className="till-gate__card">
        <div className="till-gate__brand">INT<span>.</span></div>
        <div className="till-gate__shop">{shopName} · Till</div>

        {cashiers.length === 0 ? (
          <p className="till-gate__empty">No cashiers set up yet. Add one in Settings → Till first.</p>
        ) : !picked ? (
          <>
            <p className="till-gate__prompt">Who's on the till?</p>
            <div className="till-gate__people">
              {cashiers.map((c) => (
                <button key={c.id} className="till-gate__person" onClick={() => setPicked(c)}>
                  <span className="till-gate__avatar">{c.name.charAt(0).toUpperCase()}</span>
                  {c.name}
                </button>
              ))}
            </div>
          </>
        ) : step === 'pin' ? (
          <>
            <p className="till-gate__prompt">Hi {picked.name} — enter your PIN</p>
            <div className="till-gate__dots">
              {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={`till-gate__dot${i < pin.length ? ' on' : ''}`} />)}
            </div>
            {error && <div className="till-gate__err">{error}</div>}
            <div className="till-gate__pad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button key={d} className="till-gate__key" onClick={() => key(d)}>{d}</button>
              ))}
              <button className="till-gate__key till-gate__key--muted" onClick={() => key('del')}>⌫</button>
              <button className="till-gate__key" onClick={() => key('0')}>0</button>
              <button className="till-gate__key till-gate__key--go" disabled={pin.length < 4 || busy} onClick={verifyPin}>✓</button>
            </div>
            {cashiers.length > 1 && <button className="till-gate__link" onClick={() => setPicked(null)}>← Someone else</button>}
          </>
        ) : (
          <>
            <p className="till-gate__prompt">Cash in the drawer to start</p>
            <p className="till-gate__hint">How much money are you starting the till with? (Enter 0 if none.)</p>
            <input className="till-gate__float" type="number" inputMode="decimal" value={float} onChange={(e) => setFloat(e.target.value)} placeholder="0" autoFocus />
            {error && <div className="till-gate__err">{error}</div>}
            <button className="till-gate__start" disabled={busy} onClick={start}>{busy ? 'Starting…' : 'Start selling'}</button>
          </>
        )}
      </div>
    </div>
  );
}
