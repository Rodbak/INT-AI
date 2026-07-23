import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cedis } from '../../lib/money';
import {
  bootstrap, pendingCount, watchConnectivity, syncNow, shiftReport, closeShift,
  type PosCatalog, type ShiftReport,
} from '../../lib/pos';
import CashierLogin from './CashierLogin';
import Till from './Till';
import './Pos.css';

const SESSION_KEY = 'int-pos-session';
interface Session { cashierId: string; cashierName: string; shiftId: string }

function loadSession(): Session | null {
  try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export default function PosPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [error, setError] = useState('');
  const [session, setSession] = useState<Session | null>(loadSession());
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [closing, setClosing] = useState<ShiftReport | null>(null);

  const refreshPending = useCallback(() => { pendingCount().then(setPending); }, []);

  const loadCatalog = useCallback(() => {
    bootstrap().then(setCatalog).catch((e) => setError(e instanceof Error ? e.message : 'Could not load the till'));
  }, []);

  useEffect(() => {
    loadCatalog();
    refreshPending();
    const stop = watchConnectivity((o) => { setOnline(o); if (o) syncNow().then(refreshPending); });
    const iv = setInterval(refreshPending, 4000);
    return () => { stop(); clearInterval(iv); };
  }, [loadCatalog, refreshPending]);

  const startSession = (s: Session) => { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); setSession(s); };
  const endSession = () => { localStorage.removeItem(SESSION_KEY); setSession(null); setClosing(null); };
  const exit = () => navigate('/home');

  const beginClose = async () => {
    if (!session) return;
    try { const { report } = await shiftReport(session.shiftId); setClosing(report); }
    catch { setClosing(null); endSession(); } // if we can't reach the server, just end locally
  };

  if (error && !catalog) {
    return (
      <div className="till-gate">
        <button className="till-gate__exit" onClick={exit}>← Dashboard</button>
        <div className="till-gate__card"><p className="till-gate__empty">{error}</p></div>
      </div>
    );
  }
  if (!catalog) return <div className="till-loading">Loading the till…</div>;

  if (closing) return <CloseShift report={closing} online={online} pending={pending} onDone={endSession} onBack={() => setClosing(null)} />;
  if (!session) return <CashierLogin shopName={catalog.shopName} cashiers={catalog.cashiers} onStarted={startSession} onExit={exit} />;

  return (
    <Till
      catalog={catalog}
      session={session}
      online={online}
      pending={pending}
      onCloseShift={beginClose}
      onExit={exit}
      onSold={() => { refreshPending(); loadCatalog(); }}
    />
  );
}

function CloseShift({ report, online, pending, onDone, onBack }: { report: ShiftReport; online: boolean; pending: number; onDone: () => void; onBack: () => void }) {
  const [counted, setCounted] = useState('');
  const [result, setResult] = useState<ShiftReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = async () => {
    setBusy(true); setError('');
    try { const { report: r } = await closeShift(report.id, parseFloat(counted) || 0); setResult(r); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not close the shift'); }
    finally { setBusy(false); }
  };

  const r = result || report;
  return (
    <div className="till-gate">
      <div className="till-gate__card till-gate__card--wide">
        <div className="till-gate__brand">INT<span>.</span></div>
        <div className="till-gate__shop">End of shift · {r.cashier}</div>

        <div className="zrep">
          <div className="zrep__row"><span>Opening float</span><b>{cedis(r.openingFloat)}</b></div>
          <div className="zrep__row"><span>Sales ({r.salesCount})</span><b>{cedis(r.salesTotal)}</b></div>
          <div className="zrep__sub">
            {Object.entries(r.byMethod).filter(([, v]) => v > 0).map(([k, v]) => (
              <div key={k} className="zrep__mrow"><span>{k.toUpperCase()}</span><span>{cedis(v)}</span></div>
            ))}
          </div>
          <div className="zrep__row zrep__row--strong"><span>Cash expected in drawer</span><b>{cedis(r.expectedCash)}</b></div>
        </div>

        {!result ? (
          <>
            {pending > 0 && <p className="till-gate__hint">{pending} sale{pending === 1 ? '' : 's'} still waiting to sync{online ? '…' : ' (offline)'}.</p>}
            <label className="till-gate__label">Count the cash in the drawer</label>
            <input className="till-gate__float" type="number" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0" autoFocus />
            {error && <div className="till-gate__err">{error}</div>}
            <div className="zrep__actions">
              <button className="till-gate__link" onClick={onBack}>← Back to till</button>
              <button className="till-gate__start" disabled={busy} onClick={finish}>{busy ? 'Closing…' : 'Close shift'}</button>
            </div>
          </>
        ) : (
          <>
            <div className="zrep__row zrep__row--strong"><span>Counted</span><b>{cedis(r.countedCash || 0)}</b></div>
            <div className={`zrep__variance ${(r.variance || 0) === 0 ? 'ok' : (r.variance || 0) > 0 ? 'over' : 'short'}`}>
              {(r.variance || 0) === 0 ? 'Balances exactly 🎉' : (r.variance || 0) > 0 ? `Over by ${cedis(r.variance || 0)}` : `Short by ${cedis(Math.abs(r.variance || 0))}`}
            </div>
            <button className="till-gate__start" onClick={onDone}>Done</button>
          </>
        )}
      </div>
    </div>
  );
}
