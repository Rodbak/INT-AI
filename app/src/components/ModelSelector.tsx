import { useEffect, useRef, useState } from 'react';
import './ModelSelector.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const MODELS = [
  { id: 'auto', name: 'Auto-select model' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
];

export default function ModelSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = MODELS.find((m) => m.id === value) || MODELS[0];

  return (
    <div className="model-selector" ref={ref}>
      <button
        type="button"
        className="model-selector__button"
        onClick={() => setOpen((v) => !v)}
      >
        {selected.name}
        <span className={`model-selector__chevron${open ? ' model-selector__chevron--open' : ''}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="model-selector__menu">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`model-selector__item${m.id === value ? ' model-selector__item--active' : ''}`}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
