import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCooBrief, getSetupStatus, getInsight, approveCooAction, type CooBrief } from '../lib/api';
import Onboarding from '../components/Onboarding';
import InsightCard from '../components/InsightCard';
import './CooHomePage.css';

const cedis = (n: number) => `GH₵ ${Math.round(n).toLocaleString()}`;

// Hour of day in the shop's timezone (Accra) so the greeting is right even if
// the device clock/timezone is off.
function accraHour(): number {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Africa/Accra' }).format(new Date()));
  } catch {
    return new Date().getHours();
  }
}
function greeting() {
  const h = accraHour();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function CooHomePage() {
  const [brief, setBrief] = useState<CooBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [ask, setAsk] = useState('');
  const [doneActions, setDoneActions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const navigate = useNavigate();

  const loadHome = () => {
    setLoading(true);
    Promise.all([getSetupStatus().catch(() => ({ needsSetup: false, shopName: '' })), getCooBrief().catch(() => null)])
      .then(([setup, b]) => {
        setNeedsSetup(setup.needsSetup);
        setBrief(b);
        // Hand the shop name to the TopBar (which doesn't fetch the brief itself).
        const shop = b?.shopName || setup.shopName;
        if (shop) { try { localStorage.setItem('int-shop', shop); } catch { /* ignore */ } }
        // A warm AI note about the day (only once we know the shop isn't empty).
        if (b && !b.empty && !setup.needsSetup) {
          getInsight().then((i) => setInsight(i.narrative)).catch(() => {}).finally(() => setInsightLoading(false));
        } else {
          setInsightLoading(false);
        }
      })
      .finally(() => setLoading(false));
  };
  useEffect(loadHome, []);

  const submitAsk = () => {
    if (!ask.trim()) return;
    navigate(`/current-task?ask=${encodeURIComponent(ask.trim())}`);
  };

  const approve = async (a: CooBrief['actions'][number]) => {
    setBusy(a.title);
    try {
      const r = await approveCooAction({ kind: a.kind, title: a.title, detail: a.detail, payload: a.payload });
      setDoneActions((p) => ({ ...p, [a.title]: r.message }));
    } catch {
      setDoneActions((p) => ({ ...p, [a.title]: 'Could not complete — try again.' }));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="coo"><div className="coo__loading">Loading your business…</div></div>;
  if (needsSetup) return <Onboarding onDone={loadHome} />;
  if (!brief || brief.empty) {
    return (
      <div className="coo">
        <h1 className="coo__hi">{greeting()}</h1>
        <p className="coo__empty">No business data yet. Once sales, payments and stock are recorded, INT will brief you here every day.</p>
      </div>
    );
  }

  const trend = brief.trendPct;
  const hi = brief.shopName ? `${greeting()}, ${brief.shopName}` : greeting();
  return (
    <div className="coo">
      <div className="coo__head">
        <div>
          <h1 className="coo__hi">{hi} 👋</h1>
          <p className="coo__sub">Here's your business today — {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      <div className="coo__ask">
        <input
          className="coo__ask-input"
          placeholder="Ask INT anything… “Who hasn't paid?” · “Should I restock?” · “How's cash?”"
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitAsk()}
        />
        <button className="coo__ask-btn" onClick={submitAsk}>Ask</button>
      </div>

      {/* Quick actions */}
      <div className="coo__quick">
        <button className="coo__quick-btn" onClick={() => navigate('/sales?new=1')}><span>＋</span> Record a sale</button>
        <button className="coo__quick-btn" onClick={() => navigate('/money?new=1')}><span>－</span> Record an expense</button>
      </div>

      {/* Warm AI note about today */}
      <InsightCard text={insight} loading={insightLoading} />

      {/* KPI tiles (tap to dig in) */}
      <div className="coo__kpis">
        <button className="coo__kpi" onClick={() => navigate('/money')}>
          <div className="coo__kpi-label">Cash on hand</div>
          <div className="coo__kpi-value">{cedis(brief.cashOnHand)}</div>
          {brief.cashRunwayWeeks != null && <div className="coo__kpi-note">~{brief.cashRunwayWeeks} weeks runway</div>}
        </button>
        <button className="coo__kpi" onClick={() => navigate('/customers')}>
          <div className="coo__kpi-label">Owed to you</div>
          <div className="coo__kpi-value coo__neg">{cedis(brief.receivablesTotal)}</div>
          <div className="coo__kpi-note">{brief.receivablesCount} customer{brief.receivablesCount === 1 ? '' : 's'}</div>
        </button>
        <button className="coo__kpi" onClick={() => navigate('/reports')}>
          <div className="coo__kpi-label">Sales this week</div>
          <div className="coo__kpi-value">{cedis(brief.salesThisWeek)}</div>
          {trend != null && (
            <div className={`coo__kpi-note ${trend >= 0 ? 'coo__pos' : 'coo__neg'}`}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last week
            </div>
          )}
        </button>
        {brief.bestSeller && (
          <button className="coo__kpi" onClick={() => navigate('/stock')}>
            <div className="coo__kpi-label">Best seller</div>
            <div className="coo__kpi-value coo__kpi-value--sm">{brief.bestSeller.name}</div>
            <div className="coo__kpi-note coo__pos">{brief.bestSeller.marginPct}% margin</div>
          </button>
        )}
      </div>

      {/* Decision cards */}
      {brief.actions.length > 0 && (
        <div className="coo__section">
          <div className="coo__section-title">INT recommends</div>
          <div className="coo__cards">
            {brief.actions.map((a) => (
              <div key={a.title} className="coo__card">
                <div className="coo__card-title">{a.title}</div>
                <div className="coo__card-detail">{a.detail}</div>
                {doneActions[a.title] ? (
                  <div className="coo__card-done">✓ {doneActions[a.title]}</div>
                ) : (
                  <div className="coo__card-actions">
                    <button className="coo__btn coo__btn--pri" disabled={busy === a.title} onClick={() => approve(a)}>
                      {busy === a.title ? 'Working…' : a.cta}
                    </button>
                    <button className="coo__btn" onClick={() => setDoneActions((p) => ({ ...p, [a.title]: 'Dismissed.' }))}>Not now</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="coo__cols">
        {/* Who owes you */}
        <div className="coo__section">
          <div className="coo__section-title">Who owes you</div>
          <div className="coo__list">
            {brief.receivables.length === 0 && <div className="coo__list-empty">Everyone's paid up 🎉</div>}
            {brief.receivables.map((r) => (
              <div key={r.invoiceId} className="coo__row">
                <div>
                  <div className="coo__row-main">{r.customer}</div>
                  <div className="coo__row-sub">
                    {r.number} ·{' '}
                    {r.daysOverdue > 0 ? <span className="coo__neg">{r.daysOverdue}d overdue</span> : <span className="coo__muted">due in {Math.abs(r.daysOverdue)}d</span>}
                  </div>
                </div>
                <div className="coo__row-amt">{cedis(r.outstanding)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Running low */}
        <div className="coo__section">
          <div className="coo__section-title">Running low</div>
          <div className="coo__list">
            {brief.lowStock.length === 0 && <div className="coo__list-empty">Stock looks healthy.</div>}
            {brief.lowStock.map((p) => (
              <div key={p.id} className="coo__row">
                <div>
                  <div className="coo__row-main">{p.name}</div>
                  <div className="coo__row-sub">reorder at {p.reorderPoint} {p.unit}s</div>
                </div>
                <div className="coo__row-amt coo__neg">{p.stock} left</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
