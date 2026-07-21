import { useState, useEffect, useRef } from 'react';
import { fetchKnowledge, deleteDocument, createTextDocument } from '../lib/api';
import { useWorkspace } from '../hooks/useWorkspace';
import type { KnowledgeDoc } from '../types/index';
import './KnowledgePage.css';

const TYPE_ICON: Record<string, string> = {
  pdf: 'PDF',
  doc: 'DOC',
  sheet: 'XLS',
  text: 'TXT',
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { workspaceId } = useWorkspace();

  useEffect(() => {
    fetchKnowledge()
      .then(setDocs)
      .catch((err) => console.error('Failed to load documents:', err))
      .finally(() => setLoading(false));
  }, []);

  const refresh = () => fetchKnowledge().then(setDocs).catch(() => {});

  const handleDelete = async (doc: KnowledgeDoc) => {
    if (!window.confirm(`Remove "${doc.title}" from the knowledge base?`)) return;
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    try {
      await deleteDocument(doc.id);
    } catch {
      refresh();
    }
  };

  const save = async (docTitle: string, docContent: string) => {
    if (!workspaceId) {
      setError('No workspace found yet — try again in a moment.');
      return;
    }
    if (!docTitle.trim() || !docContent.trim()) {
      setError('Give the document a title and some text.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createTextDocument({ title: docTitle.trim(), content: docContent, workspaceId });
      await refresh();
      setTitle('');
      setContent('');
      setShowForm(false);
    } catch (err: any) {
      setError(err?.message || 'Could not save document');
    } finally {
      setSaving(false);
    }
  };

  // Read text-like files client-side and index them as searchable documents.
  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const text = await file.text();
        if (text.trim()) {
          await createTextDocument({ title: file.name, content: text, workspaceId: workspaceId! });
        }
      }
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Could not read file');
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="knowledge">
      <div className="knowledge__header">
        <div>
          <h1 className="knowledge__title">Knowledge Base</h1>
          <p className="knowledge__subtitle">Text your assistants can search and cite</p>
        </div>
        <div className="knowledge__actions">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.markdown,.csv,.json,.log"
            onChange={handleFiles}
            style={{ display: 'none' }}
          />
          <button
            className="knowledge__upload knowledge__upload--ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving || !workspaceId}
          >
            {saving ? 'Working…' : 'Import text file'}
          </button>
          <button
            className="knowledge__upload"
            onClick={() => setShowForm((v) => !v)}
            disabled={!workspaceId}
          >
            {showForm ? 'Close' : '+ Add text'}
          </button>
        </div>
      </div>

      <div className="knowledge__note">
        Paste or import text and your assistants will retrieve the most relevant passages and{' '}
        <strong>cite them</strong> in answers — no embeddings key required (keyword retrieval). PDFs/Word
        aren't parsed here; paste their text.
      </div>

      {showForm && (
        <div className="knowledge__form">
          <input
            className="knowledge__input"
            placeholder="Document title (e.g. Company handbook)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="knowledge__textarea"
            placeholder="Paste the document text here…"
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="knowledge__form-actions">
            <button
              className="knowledge__upload"
              onClick={() => save(title, content)}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save & index'}
            </button>
          </div>
        </div>
      )}

      {error && <div className="knowledge__error">{error}</div>}
      {loading ? (
        <div className="knowledge__empty">Loading...</div>
      ) : docs.length === 0 ? (
        <div className="knowledge__empty">No documents yet — add text to make it searchable.</div>
      ) : (
        <div className="knowledge__list">
          {docs.map((doc) => (
            <div key={doc.id} className="knowledge__item">
              <div className="knowledge__icon">{TYPE_ICON[doc.type] || 'TXT'}</div>
              <div className="knowledge__info">
                <div className="knowledge__title">{doc.title}</div>
                <div className="knowledge__filename">{doc.filename}</div>
                <div className="knowledge__meta">
                  {formatSize(doc.size)} · {new Date(doc.createdAt).toLocaleDateString()} ·{' '}
                  {doc.workspace?.name}
                </div>
              </div>
              <button
                type="button"
                className="knowledge__delete"
                onClick={() => handleDelete(doc)}
                aria-label={`Remove ${doc.title}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
