import { useEffect, useState } from 'react';
import { pushSupported, isPushAvailable, isPushEnabled, enablePush, disablePush } from '../lib/push';
import './NotifyToggle.css';

/**
 * A small card on Home that lets the owner get INT's morning & evening summary
 * as a phone notification — so they stay across the shop even when they're away.
 * Self-hides when the device or server can't do push, or is dismissed.
 */
export default function NotifyToggle() {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    (async () => {
      const [avail, on] = await Promise.all([isPushAvailable(), isPushEnabled()]);
      setAvailable(avail);
      setEnabled(on);
    })();
  }, []);

  const turnOn = async () => {
    setBusy(true); setMsg('');
    const r = await enablePush();
    setBusy(false);
    if (r.ok) { setEnabled(true); setMsg('Done! A test notification is on its way. 📲'); }
    else setMsg(r.reason || 'Could not turn on notifications.');
  };
  const turnOff = async () => {
    setBusy(true); setMsg('');
    await disablePush();
    setBusy(false); setEnabled(false); setMsg('Turned off. You can switch it back on anytime.');
  };

  if (!pushSupported() || !available || dismissed) return null;

  return (
    <div className={`notify ${enabled ? 'notify--on' : ''}`}>
      <div className="notify__icon" aria-hidden>{enabled ? '🔔' : '📲'}</div>
      <div className="notify__body">
        <div className="notify__title">{enabled ? 'Daily summaries are on for this phone' : 'Get your daily summary on this phone'}</div>
        <div className="notify__text">
          {enabled
            ? "INT will send a short recap every morning and evening — even when you're away from the shop."
            : "INT sends a quick recap of sales, cash and what needs attention every morning and evening. Great for when you're not at the shop."}
        </div>
        {msg && <div className="notify__msg">{msg}</div>}
      </div>
      <div className="notify__actions">
        {enabled ? (
          <button className="notify__btn" onClick={turnOff} disabled={busy}>{busy ? '…' : 'Turn off'}</button>
        ) : (
          <>
            <button className="notify__btn notify__btn--pri" onClick={turnOn} disabled={busy}>{busy ? 'Turning on…' : 'Turn on'}</button>
            <button className="notify__btn notify__btn--ghost" onClick={() => setDismissed(true)}>Not now</button>
          </>
        )}
      </div>
    </div>
  );
}
