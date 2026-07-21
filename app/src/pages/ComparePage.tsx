import { useState } from 'react';
import { MODELS } from '../components/ModelSelector';
import { runModelOnce } from '../lib/api';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { neural, providerNode, CORE } from '../lib/neural';
import './ComparePage.css';

const CANDIDATES = MODELS.filter((m) => m.id !== 'auto');

interface Result {
  status: 'running' | 'done' | 'error';
  reply?: string;
  error?: string;
  latencyMs?: number;
  cost?: number;
  tokens?: number;
}

export default function ComparePage() {
  const [prompt, setPrompt] = useState('');
  const [selected, setSelected] = useState<string[]>(
    CANDIDATES.filter((m) => m.provider === 'openrouter').slice(0, 2).map((m) => m.id),
  );
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, Result>>({});

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id],
    );
  };

  const run = async () => {
    if (!prompt.trim() || selected.length === 0 || running) return;
    setRunning(true);
    setResults(Object.fromEntries(selected.map((id) => [id, { status: 'running' } as Result])));
    neural.arouse(1, 6000);

    await Promise.all(
      selected.map(async (id) => {
        const model = CANDIDATES.find((m) => m.id === id);
        const provider = model?.provider;
        if (provider) {
          neural.fire(providerNode(provider), 1);
          neural.signal(CORE, providerNode(provider), 'accent');
        }
        try {
          const r = await runModelOnce(prompt.trim(), id, provider);
          setResults((prev) => ({
            ...prev,
            [id]: {
              status: 'done',
              reply: r.reply,
              latencyMs: r.latencyMs,
              cost: r.usage?.cost,
              tokens: r.usage?.totalTokens,
            },
          }));
        } catch (err: any) {
          setResults((prev) => ({
            ...prev,
            [id]: { status: 'error', error: err?.message || 'Request failed' },
          }));
        }
      }),
    );
    neural.calm();
    setRunning(false);
  };

  return (
    <div className="compare">
      <div className="compare__header">
        <h1 className="compare__title">Model Face-off</h1>
        <p className="compare__subtitle">Send one prompt to several models and compare side by side.</p>
      </div>

      <div className="compare__controls">
        <textarea
          className="compare__prompt"
          placeholder="Ask something to compare across models…"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="compare__models">
          {CANDIDATES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`compare__chip${selected.includes(m.id) ? ' compare__chip--on' : ''}`}
              onClick={() => toggle(m.id)}
              disabled={running}
              title={`${m.provider}`}
            >
              {m.name}
            </button>
          ))}
        </div>
        <div className="compare__run-row">
          <span className="compare__hint">{selected.length}/3 selected</span>
          <button
            className="compare__run"
            onClick={run}
            disabled={running || !prompt.trim() || selected.length === 0}
          >
            {running ? 'Running…' : 'Run face-off'}
          </button>
        </div>
      </div>

      {selected.length > 0 && Object.keys(results).length > 0 && (
        <div className="compare__grid" style={{ ['--cols' as any]: Math.min(selected.length, 3) }}>
          {selected.map((id) => {
            const model = CANDIDATES.find((m) => m.id === id);
            const r = results[id];
            return (
              <div key={id} className="compare__card">
                <div className="compare__card-head">
                  <span className="compare__card-name">{model?.name || id}</span>
                  <span className="compare__card-provider">{model?.provider}</span>
                </div>
                <div className="compare__card-body">
                  {!r || r.status === 'running' ? (
                    <div className="compare__loading">
                      <span className="compare__loading-dot" /> Thinking…
                    </div>
                  ) : r.status === 'error' ? (
                    <div className="compare__card-error">{r.error}</div>
                  ) : (
                    <MarkdownRenderer content={r.reply || ''} />
                  )}
                </div>
                {r?.status === 'done' && (
                  <div className="compare__card-foot">
                    <span>{r.latencyMs} ms</span>
                    {r.tokens ? <span>{r.tokens} tok</span> : null}
                    {typeof r.cost === 'number' ? <span>${r.cost.toFixed(4)}</span> : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
