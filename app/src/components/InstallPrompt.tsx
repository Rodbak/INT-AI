import { useEffect, useState } from 'react';
import './InstallPrompt.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'int-install-dismissed';

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}
function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

/**
 * A slim, branded "install INT on your phone" banner. Uses the Android
 * beforeinstallprompt event; on iOS Safari (which has no such event) it shows
 * the Share → Add to Home Screen hint instead. Dismissible and remembered.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch { /* ignore */ }
    if (dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS never fires the event — show the manual hint after a short delay.
    let t: number | undefined;
    if (isIOS()) t = window.setTimeout(() => { setIosHint(true); setShow(true); }, 2500);

    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); if (t) clearTimeout(t); };
  }, []);

  const close = () => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    close();
  };

  if (!show) return null;

  return (
    <div className="install" role="dialog" aria-label="Install INT">
      <div className="install__icon" aria-hidden>INT</div>
      <div className="install__body">
        <div className="install__title">Put INT on your phone</div>
        <div className="install__text">
          {iosHint
            ? 'Tap the Share button, then “Add to Home Screen”.'
            : 'Add INT to your home screen for one-tap access and daily summaries.'}
        </div>
      </div>
      {!iosHint && deferred && <button className="install__btn" onClick={install}>Install</button>}
      <button className="install__x" onClick={close} aria-label="Dismiss">×</button>
    </div>
  );
}
