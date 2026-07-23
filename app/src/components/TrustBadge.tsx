import type { Trust } from '../lib/api';
import './TrustBadge.css';

/** A small colored chip showing how reliably a customer pays back credit. */
export default function TrustBadge({ trust, showScore = false }: { trust?: Trust | null; showScore?: boolean }) {
  if (!trust) return null;
  return (
    <span className={`trust trust--${trust.band}`} title={trust.reason}>
      <span className="trust__dot" aria-hidden />
      {trust.label}{showScore ? ` · ${trust.score}` : ''}
    </span>
  );
}
