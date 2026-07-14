import './CostBadge.css';

interface CostBadgeProps {
  tokens?: number;
  cost?: number;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(value);
}

export default function CostBadge({ tokens, cost }: CostBadgeProps) {
  if (tokens === undefined && cost === undefined) {
    return null;
  }

  const parts: string[] = [];
  if (tokens !== undefined) {
    parts.push(formatNumber(tokens) + ' tokens');
  }
  if (cost !== undefined) {
    parts.push('$' + cost.toFixed(2));
  }

  return <span className="cost-badge">{parts.join(' · ')}</span>;
}
