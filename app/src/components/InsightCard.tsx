import './InsightCard.css';

interface Props {
  text: string | null;
  loading?: boolean;
  compact?: boolean;
}

/** A warm "note from INT" — AI-written narrative about the business. */
export default function InsightCard({ text, loading, compact }: Props) {
  if (!loading && !text) return null;
  return (
    <div className={`insight${compact ? ' insight--compact' : ''}`}>
      <div className="insight__badge">INT</div>
      <div className="insight__body">
        <div className="insight__label">INT’s take</div>
        {loading ? (
          <div className="insight__loading">
            <span /><span /><span />
          </div>
        ) : (
          <p className="insight__text">{text}</p>
        )}
      </div>
    </div>
  );
}
