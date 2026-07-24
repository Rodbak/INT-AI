import { useEffect, useState } from 'react';
import { getCredits, topUpCredits, verifyTopUp, type CreditSummary } from '../lib/api';
import './CreditsSection.css';

const PRESETS = [10, 20, 50, 100];

/** "AI Credits" panel in Settings: balance, buy credits via Paystack, history. */
export default function CreditsSection() {
  const [data, setData] = useState<CreditSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => getCredits().then(setData).catch(() => setData(null));

  useEffect(() => {
    load();
    // Returning from Paystack? Confirm the payment and credit the wallet.
    const ref = new URLSearchParams(window.location.search).get('topup');
    if (ref) {
      verifyTopUp(ref)
        .then((r) => { if (r.ok) { setMsg(`Top-up successful — ${r.credited ?? ''} credits added.`); load(); } })
        .catch(() => {})
        .finally(() => window.history.replaceState({}, '', window.location.pathname));
    }
  }, []);

  const buy = async (amountCedis: number) => {
    setBusy(true); setMsg('');
    try {
      const { authorizationUrl } = await topUpCredits(amountCedis);
      window.location.href = authorizationUrl; // off to Paystack checkout
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not start the payment.');
      setBusy(false);
    }
  };

  // Hide entirely unless billing is switched on for this deployment.
  if (!data || !data.enabled) return null;

  return (
    <div className="settings__section">
      <h2 className="settings__section-title">AI Credits</h2>
      <div className="credits__balance">
        <div className="credits__balance-num">{data.balance.toLocaleString()}</div>
        <div className="credits__balance-label">credits left</div>
      </div>
      <p className="settings__hint">
        Credits power INT’s AI — chatting, drafting messages, insights and photo scans.
        {data.creditsPerCedi ? ` GH₵1 ≈ ${data.creditsPerCedi} credits.` : ''}
      </p>

      {msg && <div className="settings__message">{msg}</div>}

      {data.paystackReady ? (
        <div className="credits__buy">
          {PRESETS.map((amt) => (
            <button key={amt} className="credits__buy-btn" disabled={busy} onClick={() => buy(amt)}>GH₵ {amt}</button>
          ))}
        </div>
      ) : (
        <p className="settings__hint">Top-ups aren’t available yet — payments are being set up.</p>
      )}

      {data.history.length > 0 && (
        <div className="credits__history">
          {data.history.slice(0, 8).map((t) => (
            <div key={t.id} className="credits__row">
              <span className="credits__row-note">{t.note || t.type}</span>
              <span className={t.amount >= 0 ? 'credits__pos' : 'credits__neg'}>{t.amount >= 0 ? '+' : ''}{t.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
