import { useState } from 'react';
import { TillIcon, MessageIcon, CameraIcon } from './icons';
import './WelcomeTips.css';

const SEEN_KEY = 'int-welcome-seen';

const TIPS = [
  { icon: <TillIcon className="wt__ic" />, title: 'Open the till to sell', text: 'Tap “Open till” to ring up sales fast — even with no internet. Everything syncs later.' },
  { icon: <span className="wt__emoji">💬</span>, title: 'Ask INT anything', text: '“Who hasn’t paid me?”, “How’s my cash?” — INT answers from your real numbers.' },
  { icon: <CameraIcon className="wt__ic" />, title: 'Snap to add stock', text: 'On the Stock page, take a photo of a shelf or delivery and INT lists the items for you.' },
  { icon: <MessageIcon className="wt__ic" />, title: 'Log a MoMo message', text: 'Paste a MoMo or bank SMS and INT records it as cash-in or an expense.' },
];

/** A one-time, friendly "here's what INT can do" card shown on first visit. */
export default function WelcomeTips() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(SEEN_KEY) !== '1'; } catch { return false; }
  });
  if (!open) return null;

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div className="wt__overlay" onClick={close}>
      <div className="wt" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Welcome to INT">
        <div className="wt__head">
          <div className="wt__hi">Welcome to INT 👋</div>
          <p className="wt__sub">Your shop’s AI business partner. Here are a few things you can do:</p>
        </div>
        <div className="wt__tips">
          {TIPS.map((t) => (
            <div key={t.title} className="wt__tip">
              <div className="wt__tip-ic">{t.icon}</div>
              <div>
                <div className="wt__tip-title">{t.title}</div>
                <div className="wt__tip-text">{t.text}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="wt__go" onClick={close}>Let’s go</button>
      </div>
    </div>
  );
}
