import { useState, useEffect, useCallback } from 'react';
import { fetchTeams, createTeam, deleteTeam, fetchSpecialists } from '../lib/api';
import { useWorkspace } from '../hooks/useWorkspace';
import Modal from '../components/Modal';
import type { AITeam, Specialist } from '../types/index';
import './AITeamsPage.css';

export default function AITeamsPage() {
  const { workspaceId } = useWorkspace();
  const [teams, setTeams] = useState<AITeam[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchTeams(), fetchSpecialists()])
      .then(([t, s]) => {
        setTeams(t);
        setSpecialists(s);
      })
      .catch((err) => setError(err?.message || 'Failed to load teams'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setName('');
    setDescription('');
    setSelected(new Set());
    setError(null);
    setModalOpen(true);
  };

  const toggleSpecialist = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Team name is required.');
      return;
    }
    if (!workspaceId) {
      setError('No workspace available yet — try again in a moment.');
      return;
    }
    setSaving(true);
    setError(null);
    const members = [...selected].map((specialistId, order) => ({ specialistId, order }));
    try {
      await createTeam({ name: name.trim(), description: description.trim() || undefined, workspaceId, members });
      setModalOpen(false);
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to create team');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (team: AITeam) => {
    if (!window.confirm(`Delete team "${team.name}"?`)) return;
    setTeams((prev) => prev.filter((t) => t.id !== team.id));
    try {
      await deleteTeam(team.id);
    } catch {
      load();
    }
  };

  return (
    <div className="ai-teams">
      <div className="ai-teams__header">
        <div>
          <h1 className="ai-teams__title">AI Teams</h1>
          <p className="ai-teams__subtitle">Collaborative teams of AI specialists</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + New team
        </button>
      </div>

      {error && !modalOpen && <div className="ai-teams__error">{error}</div>}

      {loading ? (
        <div className="ai-teams__empty">Loading…</div>
      ) : teams.length === 0 ? (
        <div className="ai-teams__empty">
          <p>No teams yet</p>
          <button type="button" className="btn-ghost" onClick={openCreate}>
            Create your first team
          </button>
        </div>
      ) : (
        <div className="ai-teams__grid">
          {teams.map((team) => (
            <div key={team.id} className="ai-teams__card">
              <div className="ai-teams__card-head">
                <div className="ai-teams__card-title">{team.name}</div>
                <button
                  type="button"
                  className="ai-teams__card-btn ai-teams__card-btn--danger"
                  onClick={() => handleDelete(team)}
                >
                  Delete
                </button>
              </div>
              {team.description && <p className="ai-teams__card-desc">{team.description}</p>}
              <div className="ai-teams__card-meta">
                {team.members.length} specialists · {team.workspace?.name}
              </div>
              <div className="ai-teams__members">
                {team.members.map((member) => (
                  <span key={member.id} className="ai-teams__member">
                    {member.specialist.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title="New team"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Create team'}
            </button>
          </>
        }
      >
        {error && <div className="ai-teams__error">{error}</div>}
        <div className="field">
          <label className="field__label">Team name</label>
          <input
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Research squad"
            autoFocus
          />
        </div>
        <div className="field">
          <label className="field__label">Description</label>
          <textarea
            className="field__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this team does…"
            rows={3}
          />
        </div>
        <div className="field">
          <label className="field__label">Specialists</label>
          {specialists.length === 0 ? (
            <div className="field__hint">No specialists available — create some on the Specialists page first.</div>
          ) : (
            <div className="ai-teams__picker">
              {specialists.map((s) => (
                <label key={s.id} className="ai-teams__pick">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggleSpecialist(s.id)}
                  />
                  <span className="ai-teams__pick-name">{s.name}</span>
                  <span className="ai-teams__pick-role">{s.role}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
