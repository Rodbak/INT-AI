import { useState, useEffect } from 'react';
import { fetchConversations } from '../../lib/api';
import type { Conversation } from '../../types';
import './HistoryPage.css';

export default function HistoryPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations()
      .then((data) => setConversations(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="history">
      <div className="history__header">
        <h1 className="history__title">History</h1>
        <p className="history__subtitle">Browse your past conversations</p>
      </div>
      {loading ? (
        <div className="history__empty">Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="history__empty">No conversations yet</div>
      ) : (
        <div className="history__list">
          {conversations.map((conv) => (
            <div key={conv.id} className="history__item">
              <div className="history__item-title">{conv.title}</div>
              <div className="history__item-preview">{conv.preview}</div>
              <div className="history__item-meta">
                <span>{new Date(conv.updatedAt).toLocaleDateString()}</span>
                <span>{conv.model}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
