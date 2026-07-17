import { useState, useEffect, useRef } from 'react';
import { fetchKnowledge, uploadFile } from '../lib/api';
import type { KnowledgeDoc } from '../types/index';
import './KnowledgePage.css';

const TYPE_ICON: Record<string, string> = {
  pdf: 'PDF',
  doc: 'DOC',
  sheet: 'XLS',
  text: 'TXT',
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchKnowledge()
      .then(setDocs)
      .catch((err) => console.error('Failed to load documents:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const uploadPromises = Array.from(files).map((file) => uploadFile(file));
      const results = await Promise.all(uploadPromises);
      setDocs((prev) => [
        ...prev,
        ...results.map((r) => ({
          id: r.id,
          title: r.url.split('/').pop() || 'Untitled',
          filename: r.url.split('/').pop() || 'file',
          type: 'text',
          size: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          workspace: { id: '', name: '' },
          uploader: { id: '', email: '', name: '' },
          url: r.url,
          mimeType: 'application/octet-stream',
        })),
      ]);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="knowledge">
      <div className="knowledge__header">
        <div>
          <h1 className="knowledge__title">Knowledge Base</h1>
          <p className="knowledge__subtitle">Documents available to your assistants</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx"
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
          <button
            className="knowledge__upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      </div>
      {error && <div className="knowledge__error">{error}</div>}
      {loading ? (
        <div className="knowledge__empty">Loading...</div>
      ) : docs.length === 0 ? (
        <div className="knowledge__empty">No documents uploaded yet</div>
      ) : (
        <div className="knowledge__list">
          {docs.map((doc) => (
            <div key={doc.id} className="knowledge__item">
              <div className="knowledge__icon">{TYPE_ICON[doc.type] || 'FILE'}</div>
              <div className="knowledge__info">
                <div className="knowledge__title">{doc.title}</div>
                <div className="knowledge__filename">{doc.filename}</div>
                <div className="knowledge__meta">
                  {formatSize(doc.size)} ·{' '}
                  {new Date(doc.createdAt).toLocaleDateString()} ·{' '}
                  {doc.workspace.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
