import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNudges, getBriefing, draftMessage, type Nudge, type Briefing } from '../lib/api';
import { waLink } from '../lib/whatsapp';
import { celebrate } from '../lib/confetti';
import BizSheet from './BizSheet';
import './ProactiveFeed.css';

const cedis = (n: number) => `GH₵ ${Math.round(n).toLocaleString()}`;

function accraHour(): number {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Africa/Accra' }).format(new Date()));
  } catch {
    return new Date().getHours();
  }
}
const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Proactive INT: the things INT wants to raise before you ask — a once-a-day
 * briefing banner, plus nudge cards (chase a debt, restock, watch cash, or a
 * win to celebrate). Reminder/restock cards draft a ready-to-send WhatsApp
 * message so INT doesn't just advise, it acts.
 */
export default function ProactiveFeed() {
  const nav = useNavigate();
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('int-nudges-dismissed') || '{}');
      return new Set<string>(raw.date === todayKey() ? raw.ids : []);
    } catch {
      return new Set<string>();
    }
  });
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const slot: 'morning' | 'evening' = accraHour() < 15 ? 'morning' : 'evening';

  const [draftNudge, setDraftNudge] = useState<Nudge | null>(null);
  const [draftText, setDraftText] = useState('');
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    getNudges().then((list) => {
      setNudges(list);
      // Let the Home header orb "stir" when there are things to raise.
      window.dispatchEvent(new CustomEvent('int:nudges', { detail: { count: list.length } }));
      // Celebrate a win once per day (record sales day, etc.).
      const win = list.find((n) => n.kind === 'win');
      if (win) {
        const key = `int-celebrated-${todayKey()}`;
        let done = false;
        try { done = localStorage.getItem(key) === '1'; } catch { /* ignore */ }
        if (!done) {
          celebrate();
          try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
        }
      }
    }).catch(() => {});
    const seenKey = `int-briefing-${todayKey()}-${slot}`;
    let seen = false;
    try { seen = localStorage.getItem(seenKey) === '1'; } catch { /* ignore */ }
    if (!seen) {
      getBriefing(slot).then((b) => { if (!b.empty) { setBriefing(b); setShowBriefing(true); } }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (ids: Set<string>) => {
    try { localStorage.setItem('int-nudges-dismissed', JSON.stringify({ date: todayKey(), ids: [...ids] })); } catch { /* ignore */ }
  };
  const dismiss = (id: string) => setDismissed((prev) => { const n = new Set(prev); n.add(id); persist(n); return n; });
  const closeBriefing = () => {
    setShowBriefing(false);
    try { localStorage.setItem(`int-briefing-${todayKey()}-${slot}`, '1'); } catch { /* ignore */ }
  };

  const visible = nudges.filter((n) => !dismissed.has(n.id));

  const runAction = async (n: Nudge) => {
    if (!n.action) return;
    if (n.action.type === 'navigate') { nav(String(n.action.payload.to || '/home')); return; }
    setDraftNudge(n); setDrafting(true); setDraftText('');
    try {
      const p = n.action.payload;
      const res = n.action.type === 'remind'
        ? await draftMessage({ purpose: 'reminder', customer: String(p.customer || ''), amount: Number(p.amount || 0) })
        : await draftMessage({ purpose: 'restock', name: String(p.name || ''), qty: Number(p.qty || 0), unit: String(p.unit || 'unit') });
      setDraftText(res.text);
    } catch {
      setDraftText('Could not draft a message right now. Please try again.');
    } finally {
      setDrafting(false);
    }
  };

  const sendWhatsApp = () => {
    if (!draftNudge) return;
    const phone = draftNudge.action?.type === 'remind' ? (draftNudge.action.payload.phone as string | null) : null;
    window.open(waLink(phone, draftText), '_blank');
    dismiss(draftNudge.id);
    setDraftNudge(null);
  };
  const copyDraft = async () => { try { await navigator.clipboard.writeText(draftText); } catch { /* ignore */ } };

  if (visible.length === 0 && !showBriefing) return null;

  return (
    <>
      {showBriefing && briefing && (
        <div className="brief">
          <button className="brief__x" onClick={closeBriefing} aria-label="Dismiss briefing">×</button>
          <div className="brief__title">{briefing.title}</div>
          <div className="brief__stats">
            <div className="brief__stat">
              <span>{slot === 'morning' ? 'Yesterday' : 'Today so far'}</span>
              <b>{cedis(slot === 'morning' ? briefing.yesterday.sales : briefing.today.sales)}</b>
            </div>
            <div className="brief__stat"><span>Cash on hand</span><b>{cedis(briefing.cashOnHand)}</b></div>
          </div>
          {briefing.focus.length > 0 && <div className="brief__focus"><b>Focus:</b> {briefing.focus.join(' · ')}</div>}
          {briefing.watch && <div className="brief__watch">{briefing.watch}</div>}
        </div>
      )}

      {visible.length > 0 && (
        <div className="coo__section">
          <div className="coo__section-title">INT is watching your back</div>
          <div className="feed">
            {visible.map((n) => (
              <div key={n.id} className={`feed__card feed__card--${n.severity}`}>
                <div className="feed__emoji" aria-hidden>{n.emoji}</div>
                <div className="feed__body">
                  <div className="feed__title">{n.title}</div>
                  <div className="feed__text">{n.body}</div>
                  <div className="feed__actions">
                    {n.action && (
                      <button className="feed__btn feed__btn--pri" onClick={() => runAction(n)}>{n.action.label}</button>
                    )}
                    <button className="feed__btn" onClick={() => dismiss(n.id)}>Dismiss</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {draftNudge && (
        <BizSheet
          title={draftNudge.action?.type === 'remind' ? 'Reminder message' : 'Supplier message'}
          hint="INT wrote this for you. Edit it if you like, then send it on WhatsApp."
          onClose={() => setDraftNudge(null)}
        >
          <textarea
            className="biz__input feed__draft"
            rows={5}
            value={drafting ? 'INT is writing…' : draftText}
            onChange={(e) => setDraftText(e.target.value)}
            disabled={drafting}
          />
          <div className="biz__sheet-actions">
            <button className="biz__cancel" onClick={copyDraft} disabled={drafting || !draftText}>Copy</button>
            <button className="biz__save" onClick={sendWhatsApp} disabled={drafting || !draftText}>Send on WhatsApp</button>
          </div>
        </BizSheet>
      )}
    </>
  );
}
