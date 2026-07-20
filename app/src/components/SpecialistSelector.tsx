import { useEffect, useRef, useState } from 'react';
import type { Specialist } from '../types/index';
import './ModelSelector.css';

interface Props {
  specialists: Specialist[];
  value: string; // 'auto' | 'none' | specialist id
  onChange: (value: string) => void;
}

export default function SpecialistSelector({ specialists, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const label =
    value === 'auto'
      ? 'Auto specialist'
      : value === 'none'
        ? 'No specialist'
        : specialists.find((s) => s.id === value)?.name || 'Specialist';

  return (
    <div className="model-selector" ref={ref}>
      <button type="button" className="model-selector__button" onClick={() => setOpen((v) => !v)}>
        <span className="model-selector__dot" aria-hidden="true" />
        {label}
        <span className={`model-selector__chevron${open ? ' model-selector__chevron--open' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="model-selector__menu">
          <button
            type="button"
            className={`model-selector__item${value === 'auto' ? ' model-selector__item--active' : ''}`}
            onClick={() => {
              onChange('auto');
              setOpen(false);
            }}
          >
            Auto — route to the best specialist
          </button>
          <button
            type="button"
            className={`model-selector__item${value === 'none' ? ' model-selector__item--active' : ''}`}
            onClick={() => {
              onChange('none');
              setOpen(false);
            }}
          >
            No specialist — direct model
          </button>
          {specialists.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`model-selector__item${s.id === value ? ' model-selector__item--active' : ''}`}
              onClick={() => {
                onChange(s.id);
                setOpen(false);
              }}
            >
              {s.name}
              <span className="model-selector__sub">{s.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
