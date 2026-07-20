import { useEffect, useRef, useState } from 'react';
import { fetchPrompts } from '../lib/api';
import type { PromptTemplate } from '../types/index';
import './PromptPicker.css';

interface Props {
  onPick: (content: string) => void;
}

export default function PromptPicker({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const toggle = () => {
    setOpen((v) => !v);
    if (!loaded) {
      fetchPrompts()
        .then(setPrompts)
        .catch(() => {})
        .finally(() => setLoaded(true));
    }
  };

  const filtered = query
    ? prompts.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.content.toLowerCase().includes(query.toLowerCase()),
      )
    : prompts;

  return (
    <div className="prompt-picker" ref={ref}>
      <button
        type="button"
        className="composer__icon-button"
        onClick={toggle}
        aria-label="Insert a saved prompt"
        title="Insert a saved prompt"
      >
        <span className="prompt-picker__glyph">/</span>
      </button>
      {open && (
        <div className="prompt-picker__menu">
          <input
            className="prompt-picker__search"
            placeholder="Search prompts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="prompt-picker__list">
            {!loaded ? (
              <div className="prompt-picker__empty">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="prompt-picker__empty">
                {prompts.length === 0 ? 'No saved prompts yet' : 'No matches'}
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="prompt-picker__item"
                  onClick={() => {
                    onPick(p.content);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span className="prompt-picker__item-title">{p.title}</span>
                  <span className="prompt-picker__item-preview">
                    {p.content.length > 70 ? `${p.content.slice(0, 70)}…` : p.content}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
