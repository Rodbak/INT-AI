import { useState } from 'react';
import { fetchConversations, deleteConversation } from '../../lib/api';
import type { Conversation } from '../../types';
import './ConversationList.css';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export default function ConversationList({ conversations, activeId, onSelect, onNew }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await deleteConversation(id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="conv-list">
      <button type="button" className="conv-list__new" onClick={onNew}>
        + New conversation
      </button>
      <div className="conv-list__items">
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`conv-list__item${c.id === activeId ? ' conv-list__item--active' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <div className="conv-list__item-title">{c.title || 'Untitled'}</div>
            <div className="conv-list__item-meta">
              {c.preview || 'No messages'}
              <button
                type="button"
                className="conv-list__item-delete"
                onClick={(e) => handleDelete(c.id, e)}
                disabled={loading}
              >
                ×
              </button>
            </div>
          </button>
        ))}
        {conversations.length === 0 && (
          <div className="conv-list__empty">No conversations yet</div>
        )}
      </div>
    </div>
  );
}
