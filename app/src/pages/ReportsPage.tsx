import { useEffect, useState } from 'react';
import { cedis } from '../lib/money';
import { getReport, getInsight, type CooReport, type ReportRange } from '../lib/api';
import InsightCard from '../components/InsightCard';
import './Business.css';
import './ReportsPage.css';

const RANGES: { id: ReportRange; label: string }[] = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'lastmonth', label: 'Last month' },
  { id: 'custom', label: 'Custom…' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ReportsPage() {
  const [range, setRange] = useState<ReportRange>('month');
  const [from, setFrom] = useState(() => new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(todayISO());
  const [r, setR] = useState<CooReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);

  const fetchReport = () => {
    setLoading(true);
    getReport(range, from, to).then(setR).catch(() => {}).finally(() => setLoading(false));
  };
  // Auto-fetch for preset ranges; custom waits for the "Show" button.
  useEffect(() => {
    if (range === 'custom') return;
    setLoading(true);
    getReport(range).then(setR).catch(() => {}).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);
  useEffect(() => { getInsight().then((i) => setInsight(i.narrative)).catch(() => {}).finally(() => setInsightLoading(false)); }, []);

  const chips = (
    <>
      <div className="rep__ranges">
        {RANGES.map((rg) => (
          <button key={rg.id} className={`rep__range${range === rg.id ? ' rep__range--on' : ''}`} onClick={() => setRange(rg.id)}>{rg.label}</button>
        ))}
      </div>
      {range === 'custom' && (
        <div className="rep__custom">
          <label>From <input type="date" max={to} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To <input type="date" min={from} max={todayISO()} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button className="rep__range rep__range--on" onClick={fetchReport} disabled={!from || !to || from > to}>Show</button>
        </div>
      )}
    </>
  );

  const header = (
    <div className="biz__head">
      <div>
        <h1 className="biz__title">Reports</h1>
        <p className="biz__sub">How your business is doing{r && !r.empty ? ` — ${r.periodLabel}` : ''}.</p>
      </div>
    </div>
  );

  if (loading && !r) return <div className="biz">{header}{chips}<div className="biz__empty">Loading…</div></div>;
  if (!r || r.empty) {
    return (
      <div className="biz">
        {header}
        {chips}
        <p className="biz__sub">Once you record some sales and expenses, your business report will show here.</p>
      </div>
    );
  }

  const p = r.period;
  const netUp = p.net >= 0;
  const maxDay = Math.max(1, ...r.weekday.map((d) => d.sales));
  const hasSales = r.weekday.some((d) => d.sales > 0);
  const dailyTitle = range === '7d' ? 'Sales — day by day' : 'Sales — this period';

  return (
    <div className="biz">
      {header}
      {chips}

      <InsightCard text={insight} loading={insightLoading} />

      {/* Money in / out / net */}
      <div className="biz__summary rep__flow">
        <div className="biz__stat">
          <div className="biz__stat-label">Money in</div>
          <div className="biz__stat-value biz__pos">{cedis(p.moneyIn)}</div>
        </div>
        <div className="biz__stat">
          <div className="biz__stat-label">Money out</div>
          <div className="biz__stat-value biz__neg">{cedis(p.moneyOut)}</div>
        </div>
        <div className="biz__stat">
          <div className="biz__stat-label">{netUp ? 'You’re up by' : 'You’re down by'}</div>
          <div className={`biz__stat-value ${netUp ? 'biz__pos' : 'biz__neg'}`}>{cedis(Math.abs(p.net))}</div>
        </div>
      </div>
      <p className="rep__note">
        In {r.compareLabel} you were {r.previous.net >= 0 ? 'up' : 'down'} by {cedis(Math.abs(r.previous.net))}.
      </p>

      {/* Profit + sales */}
      <div className="biz__summary">
        <div className="biz__stat">
          <div className="biz__stat-label">Sales in this period</div>
          <div className="biz__stat-value">{cedis(p.sales)}</div>
        </div>
        <div className="biz__stat">
          <div className="biz__stat-label">Profit on goods sold</div>
          <div className="biz__stat-value biz__pos">{cedis(p.profit)}</div>
          <div className="rep__hint">what’s left after the cost of the items</div>
        </div>
      </div>

      {/* Daily sales across the period */}
      <p className="biz__section-label">{dailyTitle}</p>
      {r.dailySales.some((d) => d.sales > 0) ? (
        <div className="rep__chart-card">
          <div className="rep__bars rep__bars--daily">
            {r.dailySales.map((d, i) => {
              const maxD = Math.max(1, ...r.dailySales.map((x) => x.sales));
              const step = r.dailySales.length > 20 ? 4 : 2;
              return (
                <div key={d.date} className="rep__bar-col">
                  <div className="rep__bar-track">
                    <div className="rep__bar" style={{ height: `${Math.max(3, (d.sales / maxD) * 100)}%` }} title={`${d.label}: ${cedis(d.sales)}`} />
                  </div>
                  {i % step === 0 && <div className="rep__bar-label rep__bar-label--sm">{d.label.split(' ')[0]}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="biz__list"><div className="biz__empty">No sales recorded in this period yet.</div></div>
      )}

      {/* Busiest days */}
      <p className="biz__section-label">Your busiest days</p>
      {hasSales ? (
        <div className="rep__chart-card">
          {r.busiestDay && <p className="rep__lead"><b>{r.busiestDay}</b> is usually your best day.</p>}
          <div className="rep__bars">
            {r.weekday.map((d) => (
              <div key={d.day} className="rep__bar-col">
                <div className="rep__bar-track">
                  <div
                    className={`rep__bar${d.day === r.busiestDay ? ' rep__bar--best' : ''}`}
                    style={{ height: `${Math.max(4, (d.sales / maxDay) * 100)}%` }}
                    title={cedis(d.sales)}
                  />
                </div>
                <div className="rep__bar-label">{d.day}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="biz__list"><div className="biz__empty">Not enough sales yet to show a pattern.</div></div>
      )}

      {/* Top customers */}
      <p className="biz__section-label">Top customers</p>
      {r.topCustomers.length === 0 ? (
        <div className="biz__list"><div className="biz__empty">No named customer sales in this period.</div></div>
      ) : (
        <div className="biz__list">
          {r.topCustomers.map((c, i) => (
            <div key={c.name} className="biz__row">
              <div className="biz__row-main"><span className="rep__rank">{i + 1}.</span> {c.name}</div>
              <div className="biz__row-amt">{cedis(c.total)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Top products */}
      <p className="biz__section-label">Best-selling products</p>
      {r.topProducts.length === 0 ? (
        <div className="biz__list"><div className="biz__empty">No itemised sales in this period. Use “Pick items” when recording a sale to see this.</div></div>
      ) : (
        <div className="biz__list">
          {r.topProducts.map((prod, i) => (
            <div key={prod.name} className="biz__row">
              <div>
                <div className="biz__row-main"><span className="rep__rank">{i + 1}.</span> {prod.name}</div>
                <div className="biz__row-sub biz__pos">{cedis(prod.profit)} profit</div>
              </div>
              <div className="biz__row-amt">{cedis(prod.revenue)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
