import { useState, useEffect } from 'react';
import { fetchKnowledge } from '../../lib/api';
import type { KnowledgeDoc } from '../../types';
import './KnowledgePage.css';

const TYPE_ICON: Record<KnowledgeDoc['type'], string> = {
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

  useEffect(() => {
    fetchKnowledge()
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="knowledge">
      <div className="knowledge__header">
        <div>
          <h1 className="knowledge__title">Knowledge Base</h1>
          <p className="knowledge__subtitle">Documents available to your assistants</p>
        </div>
        <button className="knowledge__upload">Upload File</button>
      </div>
      {loading ? (
        <div className="knowledge__empty">Loading...</div>
      ) : docs.length === 0 ? (
        <div className="knowledge__empty">No documents uploaded yet</div>
      ) : (
        <div className="knowledge__list">
          {docs.map((doc) => (
            <div key={doc.id} className="knowledge__item">
              <div className="knowledge__icon">{TYPE_ICON[doc.type]}</div>
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
