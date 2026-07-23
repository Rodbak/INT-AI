import './Skeleton.css';

interface Props { w?: number | string; h?: number | string; r?: number | string; className?: string; }

/** A shimmering placeholder block used while data loads. */
export default function Skeleton({ w = '100%', h = 16, r = 8, className = '' }: Props) {
  return <span className={`sk ${className}`} style={{ width: w, height: h, borderRadius: r }} />;
}

/** A list of placeholder rows for the business pages while records load. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="biz__list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="biz__row">
          <div style={{ flex: 1 }}>
            <Skeleton w={140} h={15} r={6} />
            <div style={{ height: 8 }} />
            <Skeleton w={90} h={12} r={6} />
          </div>
          <Skeleton w={70} h={16} r={6} />
        </div>
      ))}
    </div>
  );
}
