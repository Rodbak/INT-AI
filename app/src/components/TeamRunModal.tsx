import { useRef, useState } from 'react';
import Modal from './Modal';
import MarkdownRenderer from './MarkdownRenderer';
import { runTeam, type TeamRunEvent } from '../lib/api';
import { neural, CORE, specialistNode } from '../lib/neural';
import type { AITeam } from '../types/index';
import './TeamRunModal.css';

interface StageState {
  specialist: { id: string; name: string; role: string };
  text: string;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

interface Props {
  team: AITeam;
  onClose: () => void;
}

export default function TeamRunModal({ team, onClose }: Props) {
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<'input' | 'running' | 'done'>('input');
  const [stages, setStages] = useState<StageState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const prevNodeRef = useRef<string>(CORE);

  const run = async () => {
    if (!message.trim()) return;
    setPhase('running');
    setError(null);
    setStages([]);
    prevNodeRef.current = CORE;
    neural.arouse(1, 4000);
    neural.fire(CORE, 1);

    try {
      await runTeam(team.id, message.trim(), (event: TeamRunEvent) => {
        neural.arouse(1, 3000);
        if (event.type === 'team') {
          setStages(
            event.stages.map((s) => ({ specialist: s.specialist, text: '', status: 'pending' as const })),
          );
        } else if (event.type === 'stage' && event.status === 'start' && event.specialist) {
          const node = specialistNode(event.specialist.id);
          neural.fire(node, 1);
          neural.signal(prevNodeRef.current, node, 'synapse');
          prevNodeRef.current = node;
          setStages((prev) =>
            prev.map((st, i) => (i === event.index ? { ...st, status: 'running' } : st)),
          );
        } else if (event.type === 'text') {
          setStages((prev) =>
            prev.map((st, i) => (i === event.index ? { ...st, text: st.text + event.content } : st)),
          );
        } else if (event.type === 'stage' && event.status === 'done') {
          setStages((prev) =>
            prev.map((st, i) => (i === event.index ? { ...st, status: 'done' } : st)),
          );
        } else if (event.type === 'stage' && event.status === 'error') {
          setStages((prev) =>
            prev.map((st, i) => (i === event.index ? { ...st, status: 'error', error: event.error } : st)),
          );
        } else if (event.type === 'error') {
          setError(event.error);
        } else if (event.type === 'done') {
          // signal the synthesized result back to the core
          neural.signal(prevNodeRef.current, CORE, 'accent');
        }
      });
    } catch (err: any) {
      setError(err?.message || 'Team run failed');
    } finally {
      setPhase('done');
      window.setTimeout(() => neural.calm(), 800);
    }
  };

  return (
    <Modal
      open
      title={`Run team · ${team.name}`}
      onClose={onClose}
      width={660}
      footer={
        phase === 'input' ? (
          <>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={run} disabled={!message.trim()}>
              Run team
            </button>
          </>
        ) : (
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      {phase === 'input' ? (
        <div className="field">
          <label className="field__label">What should the team work on?</label>
          <textarea
            className="field__textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the task — it will flow through each specialist in order…"
            rows={4}
            autoFocus
          />
          <div className="field__hint">
            {team.members.length} specialists:{' '}
            {team.members.map((m) => m.specialist.name).join(' → ')}
          </div>
        </div>
      ) : (
        <div className="team-run">
          {error && <div className="team-run__error">{error}</div>}
          <div className="team-run__pipeline">
            {stages.map((st, i) => (
              <div key={i} className={`team-run__stage team-run__stage--${st.status}`}>
                <div className="team-run__stage-head">
                  <span className="team-run__node" />
                  <span className="team-run__stage-name">{st.specialist.name}</span>
                  <span className="team-run__stage-role">{st.specialist.role}</span>
                  <span className="team-run__stage-status">
                    {st.status === 'running'
                      ? 'thinking…'
                      : st.status === 'done'
                        ? 'done'
                        : st.status === 'error'
                          ? 'failed'
                          : 'queued'}
                  </span>
                </div>
                {st.text && (
                  <div className="team-run__stage-body">
                    <MarkdownRenderer content={st.text} />
                  </div>
                )}
                {st.error && <div className="team-run__stage-err">{st.error}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
