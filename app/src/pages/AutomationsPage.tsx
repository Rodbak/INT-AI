import { useState, useEffect, useCallback } from 'react';
import {
  fetchAutomations,
  createAutomation,
  deleteAutomation,
  executeAutomation,
} from '../lib/api';
import { useWorkspace } from '../hooks/useWorkspace';
import Modal from '../components/Modal';
import type { Automation } from '../types/index';
import './AutomationsPage.css';

type TriggerType = 'webhook' | 'schedule' | 'manual';

export default function AutomationsPage() {
  const { workspaceId } = useWorkspace();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('manual');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAutomations()
      .then(setAutomations)
      .catch((err) => setError(err?.message || 'Failed to load automations'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setName('');
    setDescription('');
    setTriggerType('manual');
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Automation name is required.');
      return;
    }
    if (!workspaceId) {
      setError('No workspace available yet — try again in a moment.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAutomation({
        name: name.trim(),
        description: description.trim() || undefined,
        triggerType,
        workspaceId,
      });
      setModalOpen(false);
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to create automation');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a: Automation) => {
    if (!window.confirm(`Delete automation "${a.name}"?`)) return;
    setAutomations((prev) => prev.filter((x) => x.id !== a.id));
    try {
      await deleteAutomation(a.id);
    } catch {
      load();
    }
  };

  const handleRun = async (a: Automation) => {
    setRunningId(a.id);
    setNotice(null);
    try {
      await executeAutomation(a.id);
      setNotice(`Ran “${a.name}”.`);
    } catch (err: any) {
      setNotice(err?.message || `Failed to run “${a.name}”.`);
    } finally {
      setRunningId(null);
      window.setTimeout(() => setNotice(null), 3000);
    }
  };

  return (
    <div className="automations">
      <div className="automations__header">
        <div>
          <h1 className="automations__title">Automations</h1>
          <p className="automations__subtitle">Workflows and triggers</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + New automation
        </button>
      </div>

      {notice && <div className="automations__notice">{notice}</div>}
      {error && !modalOpen && <div className="automations__error">{error}</div>}

      {loading ? (
        <div className="automations__empty">Loading…</div>
      ) : automations.length === 0 ? (
        <div className="automations__empty">
          <p>No automations yet</p>
          <button type="button" className="btn-ghost" onClick={openCreate}>
            Create your first automation
          </button>
        </div>
      ) : (
        <div className="automations__list">
          {automations.map((a) => (
            <div key={a.id} className="automations__item">
              <div className="automations__item-info">
                <div className="automations__item-title">
                  {a.name}
                  <span className="automations__trigger">{a.triggerType}</span>
                  <span
                    className={`automations__status automations__status--${a.active ? 'active' : 'inactive'}`}
                  >
                    {a.active ? 'active' : 'inactive'}
                  </span>
                </div>
                <div className="automations__item-desc">{a.workspace?.name}</div>
              </div>
              <div className="automations__item-actions">
                <button
                  type="button"
                  className="automations__btn"
                  onClick={() => handleRun(a)}
                  disabled={runningId === a.id}
                >
                  {runningId === a.id ? 'Running…' : 'Run'}
                </button>
                <button
                  type="button"
                  className="automations__btn automations__btn--danger"
                  onClick={() => handleDelete(a)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title="New automation"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Create automation'}
            </button>
          </>
        }
      >
        {error && <div className="automations__error">{error}</div>}
        <div className="field">
          <label className="field__label">Name</label>
          <input
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Daily digest"
            autoFocus
          />
        </div>
        <div className="field">
          <label className="field__label">Description</label>
          <textarea
            className="field__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this automation does…"
            rows={3}
          />
        </div>
        <div className="field">
          <label className="field__label">Trigger</label>
          <select
            className="field__select"
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as TriggerType)}
          >
            <option value="manual">Manual — run on demand</option>
            <option value="schedule">Schedule — run on a timer</option>
            <option value="webhook">Webhook — run on an incoming request</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}
