import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchConversations } from '../lib/api';
import type { Conversation } from '../types/index';
import './ConversationPage.css';

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    fetchConversations()
      .then((conversations) => {
        const found = conversations.find((c) => c.id === id);
        if (found) {
          setConversation(found);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="conversation-page">Loading...</div>;
  }

  if (!conversation) {
    return (
      <div className="conversation-page">
        <div className="conversation-page__not-found">Conversation not found</div>
        <button className="conversation-page__back" onClick={() => navigate('/history')}>
          Back to History
        </button>
      </div>
    );
  }

  return (
    <div className="conversation-page">
      <div className="conversation-page__header">
        <button className="conversation-page__back" onClick={() => navigate('/history')}>
          ← Back
        </button>
        <h1 className="conversation-page__title">{conversation.title || 'Conversation'}</h1>
      </div>
      <div className="conversation-page__messages">
        {conversation.messages.map((message) => (
          <div key={message.id} className={`conversation-page__message conversation-page__message--${message.role}`}>
            <div className="conversation-page__message-role">
              {message.role === 'user' ? 'You' : 'Assistant'}
            </div>
            <div className="conversation-page__message-content">{message.text}</div>
            <div className="conversation-page__message-meta">
              {message.model && <span>{message.model}</span>}
              {message.tokens && <span>{message.tokens} tokens</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
