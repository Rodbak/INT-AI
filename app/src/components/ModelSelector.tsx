import { useEffect, useRef, useState } from 'react';
import './ModelSelector.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'openrouter';

export interface ModelOption {
  id: string;
  name: string;
  provider?: ModelProvider;
}

export const MODELS: ModelOption[] = [
  { id: 'auto', name: 'Auto-select model' },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'anthropic' },
  { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', provider: 'anthropic' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (OpenRouter)', provider: 'openrouter' },
  { id: 'openai/gpt-4o', name: 'GPT-4o (OpenRouter)', provider: 'openrouter' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (OpenRouter)', provider: 'openrouter' },
  { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick (OpenRouter)', provider: 'openrouter' },
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
