import { useEffect, useState } from 'react';
import { cedis } from '../lib/money';
import { getReport, getInsight, type CooReport } from '../lib/api';
import InsightCard from '../components/InsightCard';
import './Business.css';
import './ReportsPage.css';

export default function ReportsPage() {
  const [r, setR] = useState<CooReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);

  useEffect(() => { getReport().then(setR).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { getInsight().then((i) => setInsight(i.narrative)).catch(() => {}).finally(() => setInsightLoading(false)); }, []);

  if (loading) return <div className="biz"><div className="biz__empty">Loading…</div></div>;
  if (!r || r.empty) {
    return (
      <div className="biz">
        <h1 className="biz__title">Reports</h1>
        <p className="biz__sub">Once you record some sales and expenses, your business report will show here.</p>
      </div>
    );
  }

  const tm = r.thisMonth;
  const netUp = tm.net >= 0;
  const maxDay = Math.max(1, ...r.weekday.map((d) => d.sales));
  const hasSales = r.weekday.some((d) => d.sales > 0);

  return (
    <div className="biz">
      <div className="biz__head">
        <div>
          <h1 className="biz__title">Reports</h1>
          <p className="biz__sub">How your business is doing — {r.monthLabel}.</p>
        </div>
      </div>

      <InsightCard text={insight} loading={insightLoading} />

      {/* Money in / out / net */}
      <div className="biz__summary rep__flow">
        <div className="biz__stat">
          <div className="biz__stat-label">Money in</div>
          <div className="biz__stat-value biz__pos">{cedis(tm.moneyIn)}</div>
        </div>
        <div className="biz__stat">
          <div className="biz__stat-label">Money out</div>
          <div className="biz__stat-value biz__neg">{cedis(tm.moneyOut)}</div>
        </div>
        <div className="biz__stat">
          <div className="biz__stat-label">{netUp ? 'You’re up by' : 'You’re down by'}</div>
          <div className={`biz__stat-value ${netUp ? 'biz__pos' : 'biz__neg'}`}>{cedis(Math.abs(tm.net))}</div>
        </div>
      </div>
      <p className="rep__note">
        Last month you were {r.lastMonth.net >= 0 ? 'up' : 'down'} by {cedis(Math.abs(r.lastMonth.net))}.
      </p>

      {/* Profit + sales */}
      <div className="biz__summary">
        <div className="biz__stat">
          <div className="biz__stat-label">Sales this month</div>
          <div className="biz__stat-value">{cedis(tm.sales)}</div>
        </div>
        <div className="biz__stat">
          <div className="biz__stat-label">Profit on goods sold</div>
          <div className="biz__stat-value biz__pos">{cedis(tm.profit)}</div>
          <div className="rep__hint">what’s left after the cost of the items</div>
        </div>
      </div>

      {/* Daily sales (last 14 days) */}
      <p className="biz__section-label">Sales — last 14 days</p>
      {r.dailySales.some((d) => d.sales > 0) ? (
        <div className="rep__chart-card">
          <div className="rep__bars rep__bars--daily">
            {r.dailySales.map((d, i) => {
              const maxD = Math.max(1, ...r.dailySales.map((x) => x.sales));
              return (
                <div key={d.date} className="rep__bar-col">
                  <div className="rep__bar-track">
                    <div className="rep__bar" style={{ height: `${Math.max(3, (d.sales / maxD) * 100)}%` }} title={`${d.label}: ${cedis(d.sales)}`} />
                  </div>
                  {i % 2 === 0 && <div className="rep__bar-label rep__bar-label--sm">{d.label.split(' ')[0]}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="biz__list"><div className="biz__empty">No sales recorded in the last two weeks yet.</div></div>
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
      <p className="biz__section-label">Top customers this month</p>
      {r.topCustomers.length === 0 ? (
        <div className="biz__list"><div className="biz__empty">No named customer sales yet this month.</div></div>
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
      <p className="biz__section-label">Best-selling products this month</p>
      {r.topProducts.length === 0 ? (
        <div className="biz__list"><div className="biz__empty">No itemised sales yet this month. Use “Pick items” when recording a sale to see this.</div></div>
      ) : (
        <div className="biz__list">
          {r.topProducts.map((p, i) => (
            <div key={p.name} className="biz__row">
              <div>
                <div className="biz__row-main"><span className="rep__rank">{i + 1}.</span> {p.name}</div>
                <div className="biz__row-sub biz__pos">{cedis(p.profit)} profit</div>
              </div>
              <div className="biz__row-amt">{cedis(p.revenue)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
