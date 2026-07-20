import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchConversations } from '../lib/api';
import type { Conversation } from '../types/index';
import './HistoryPage.css';

export default function HistoryPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchConversations()
      .then((data: Conversation[]) => setConversations(data))
      .catch((err) => console.error('Failed to load conversations:', err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = query
    ? conversations.filter(
        (c) =>
          c.title?.toLowerCase().includes(query.toLowerCase()) ||
          c.preview?.toLowerCase().includes(query.toLowerCase()),
      )
    : conversations;

  return (
    <div className="history">
      <div className="history__header">
        <h1 className="history__title">History</h1>
        <p className="history__subtitle">Browse your past conversations</p>
      </div>
      {!loading && conversations.length > 0 && (
        <input
          className="history__search"
          placeholder="Search conversations…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {loading ? (
        <div className="history__empty">Loading…</div>
      ) : conversations.length === 0 ? (
        <div className="history__empty">No conversations yet</div>
      ) : filtered.length === 0 ? (
        <div className="history__empty">No conversations match “{query}”.</div>
      ) : (
        <div className="history__list">
          {filtered.map((conv) => (
            <button
              key={conv.id}
              type="button"
              className="history__item"
              onClick={() => navigate(`/conversations/${conv.id}`)}
            >
              <div className="history__item-title">{conv.title}</div>
              <div className="history__item-preview">{conv.preview}</div>
              <div className="history__item-meta">
                <span>{new Date(conv.updatedAt).toLocaleDateString()}</span>
                <span>{conv.model}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
