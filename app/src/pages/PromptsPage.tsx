import { useState, useEffect, useCallback } from 'react';
import { fetchPrompts, createPrompt, updatePrompt, deletePrompt } from '../lib/api';
import { useWorkspace } from '../hooks/useWorkspace';
import Modal from '../components/Modal';
import type { PromptTemplate } from '../types/index';
import './PromptsPage.css';

function preview(content: string): string {
  return content.length > 140 ? `${content.slice(0, 140)}…` : content;
}

interface DraftState {
  id: string | null;
  title: string;
  content: string;
  tags: string;
}

const EMPTY_DRAFT: DraftState = { id: null, title: '', content: '', tags: '' };

export default function PromptsPage() {
  const { workspaceId } = useWorkspace();
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchPrompts()
      .then(setPrompts)
      .catch((err) => setError(err?.message || 'Failed to load prompts'))
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

  const openEdit = (p: PromptTemplate) => {
    setDraft({ id: p.id, title: p.title, content: p.content, tags: (p.tags || []).join(', ') });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!draft.title.trim() || !draft.content.trim()) {
      setError('Title and content are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const tags = draft.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      if (draft.id) {
        await updatePrompt(draft.id, { title: draft.title.trim(), content: draft.content.trim(), tags });
      } else {
        if (!workspaceId) {
          setError('No workspace available yet — try again in a moment.');
          setSaving(false);
          return;
        }
        await createPrompt({ title: draft.title.trim(), content: draft.content.trim(), tags, workspaceId });
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: PromptTemplate) => {
    if (!window.confirm(`Delete prompt "${p.title}"?`)) return;
    setPrompts((prev) => prev.filter((x) => x.id !== p.id));
    try {
      await deletePrompt(p.id);
    } catch {
      load(); // restore on failure
    }
  };

  return (
    <div className="prompts">
      <div className="prompts__header">
        <div>
          <h1 className="prompts__title">Prompt Templates</h1>
          <p className="prompts__subtitle">Reusable prompts for your assistants</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + New prompt
        </button>
      </div>

      {error && !modalOpen && <div className="prompts__error">{error}</div>}

      {loading ? (
        <div className="prompts__empty">Loading…</div>
      ) : prompts.length === 0 ? (
        <div className="prompts__empty">
          <p>No prompts yet</p>
          <button type="button" className="btn-ghost" onClick={openCreate}>
            Create your first prompt
          </button>
        </div>
      ) : (
        <div className="prompts__grid">
          {prompts.map((prompt) => (
            <div key={prompt.id} className="prompts__card">
              <div className="prompts__card-head">
                <div className="prompts__card-title">{prompt.title}</div>
                <div className="prompts__card-actions">
                  <button type="button" className="prompts__card-btn" onClick={() => openEdit(prompt)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="prompts__card-btn prompts__card-btn--danger"
                    onClick={() => handleDelete(prompt)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="prompts__card-content">{preview(prompt.content)}</div>
              {prompt.tags && prompt.tags.length > 0 && (
                <div className="prompts__tags">
                  {prompt.tags.map((tag: string) => (
                    <span key={tag} className="prompts__tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="prompts__workspace">{prompt.workspace?.name}</div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={draft.id ? 'Edit prompt' : 'New prompt'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create prompt'}
            </button>
          </>
        }
      >
        {error && <div className="prompts__error">{error}</div>}
        <div className="field">
          <label className="field__label">Title</label>
          <input
            className="field__input"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="e.g. Weekly status summary"
            autoFocus
          />
        </div>
        <div className="field">
          <label className="field__label">Prompt content</label>
          <textarea
            className="field__textarea"
            value={draft.content}
            onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
            placeholder="Write the reusable prompt text…"
            rows={6}
          />
        </div>
        <div className="field">
          <label className="field__label">Tags</label>
          <input
            className="field__input"
            value={draft.tags}
            onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
            placeholder="comma, separated, tags"
          />
          <div className="field__hint">Separate tags with commas.</div>
        </div>
      </Modal>
    </div>
  );
}
