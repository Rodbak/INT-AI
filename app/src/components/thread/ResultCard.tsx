import './ResultCard.css';

interface ResultCardProps {
  before: string;
  brand: string;
  after: string;
  deliverables: string[];
}

export default function ResultCard({ before, brand, after, deliverables }: ResultCardProps) {
  return (
    <div className="result-card">
      <div className="result-card__text">
        {before} <strong>{brand}</strong> {after}
      </div>
      <div className="result-card__chips">
        {deliverables.map((d) => (
          <div className="result-card__chip" key={d}>
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}
