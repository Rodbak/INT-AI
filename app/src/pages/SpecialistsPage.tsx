import { useState, useEffect, useCallback } from 'react';
import {
  fetchSpecialists,
  createSpecialist,
  updateSpecialist,
  deleteSpecialist,
} from '../lib/api';
import { MODELS } from '../components/ModelSelector';
import Modal from '../components/Modal';
import type { Specialist } from '../types/index';
import './SpecialistsPage.css';

interface DraftState {
  id: string | null;
  name: string;
  role: string;
  description: string;
  model: string;
  capabilities: string;
  active: boolean;
}

const SELECTABLE_MODELS = MODELS.filter((m) => m.id !== 'auto');

const EMPTY_DRAFT: DraftState = {
  id: null,
  name: '',
  role: '',
  description: '',
  model: SELECTABLE_MODELS[0]?.id ?? '',
  capabilities: '',
  active: true,
};

export default function SpecialistsPage() {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchSpecialists()
      .then(setSpecialists)
      .catch((err) => setError(err?.message || 'Failed to load specialists'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (s: Specialist) => {
    setDraft({
      id: s.id,
      name: s.name,
      role: s.role,
      description: s.description || '',
      model: s.model || SELECTABLE_MODELS[0]?.id || '',
      capabilities: (s.capabilities || []).join(', '),
      active: s.active,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!draft.name.trim() || !draft.role.trim()) {
      setError('Name and role are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const capabilities = draft.capabilities
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const payload = {
      name: draft.name.trim(),
      role: draft.role.trim(),
      description: draft.description.trim(),
      model: draft.model,
      capabilities,
      active: draft.active,
    };
    try {
      if (draft.id) await updateSpecialist(draft.id, payload);
      else await createSpecialist(payload);
      setModalOpen(false);
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save specialist');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Specialist) => {
    if (!window.confirm(`Delete specialist "${s.name}"?`)) return;
    setSpecialists((prev) => prev.filter((x) => x.id !== s.id));
    try {
      await deleteSpecialist(s.id);
    } catch {
      load();
    }
  };

  return (
    <div className="specialists">
      <div className="specialists__header">
        <div>
          <h1 className="specialists__title">Specialists</h1>
          <p className="specialists__subtitle">Manage your AI specialists</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + New specialist
        </button>
      </div>

      {error && !modalOpen && <div className="specialists__error">{error}</div>}

      {loading ? (
        <div className="specialists__empty">Loading…</div>
      ) : specialists.length === 0 ? (
        <div className="specialists__empty">
          <p>No specialists yet</p>
          <button type="button" className="btn-ghost" onClick={openCreate}>
            Create your first specialist
          </button>
        </div>
      ) : (
        <div className="specialists__grid">
          {specialists.map((s) => (
            <div key={s.id} className="specialists__card">
              <div className="specialists__card-header">
                <div className="specialists__avatar">{s.name[0]}</div>
                <div className="specialists__card-header-right">
                  <span
                    className={`specialists__status specialists__status--${s.active ? 'active' : 'inactive'}`}
                  >
                    {s.active ? 'active' : 'inactive'}
                  </span>
                  <div className="specialists__card-actions">
                    <button type="button" className="specialists__card-btn" onClick={() => openEdit(s)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="specialists__card-btn specialists__card-btn--danger"
                      onClick={() => handleDelete(s)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
              <div className="specialists__name">{s.name}</div>
              <div className="specialists__role">{s.role}</div>
              <div className="specialists__model">{s.model}</div>
              <p className="specialists__desc">{s.description}</p>
              {s.capabilities && s.capabilities.length > 0 && (
                <div className="specialists__caps">
                  {s.capabilities.map((c) => (
                    <span key={c} className="specialists__cap">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={draft.id ? 'Edit specialist' : 'New specialist'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create specialist'}
            </button>
          </>
        }
      >
        {error && <div className="specialists__error">{error}</div>}
        <div className="field">
          <label className="field__label">Name</label>
          <input
            className="field__input"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Analyst"
            autoFocus
          />
        </div>
        <div className="field">
          <label className="field__label">Role</label>
          <input
            className="field__input"
            value={draft.role}
            onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
            placeholder="e.g. Data and metrics analysis"
          />
        </div>
        <div className="field">
          <label className="field__label">Model</label>
          <select
            className="field__select"
            value={draft.model}
            onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
          >
            {SELECTABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label">Description</label>
          <textarea
            className="field__textarea"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="What this specialist is good at…"
            rows={3}
          />
        </div>
        <div className="field">
          <label className="field__label">Capabilities</label>
          <input
            className="field__input"
            value={draft.capabilities}
            onChange={(e) => setDraft((d) => ({ ...d, capabilities: e.target.value }))}
            placeholder="comma, separated, skills"
          />
          <div className="field__hint">Separate capabilities with commas.</div>
        </div>
        <div className="field">
          <label className="specialists__checkbox">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
            />
            Active (available for routing)
          </label>
        </div>
      </Modal>
    </div>
  );
}
