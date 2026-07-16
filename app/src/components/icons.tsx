interface IconProps {
  className?: string;
}

const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function MicIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className} aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <line x1="12" y1="17.5" x2="12" y2="21" />
      <line x1="8.5" y1="21" x2="15.5" y2="21" />
    </svg>
  );
}

export function KeyboardIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className} aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="12" rx="2.2" />
      <line x1="6" y1="9.5" x2="6" y2="9.5" strokeWidth="2.4" />
      <line x1="9.5" y1="9.5" x2="9.5" y2="9.5" strokeWidth="2.4" />
      <line x1="13" y1="9.5" x2="13" y2="9.5" strokeWidth="2.4" />
      <line x1="16.5" y1="9.5" x2="16.5" y2="9.5" strokeWidth="2.4" />
      <line x1="6" y1="13" x2="6" y2="13" strokeWidth="2.4" />
      <line x1="18" y1="13" x2="18" y2="13" strokeWidth="2.4" />
      <line x1="9" y1="14.6" x2="15" y2="14.6" />
    </svg>
  );
}

export function StopIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className} aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className} aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
