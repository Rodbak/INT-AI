import { useState, useRef, useEffect } from 'react';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { useConversations } from '../hooks/useConversations';
import ConversationList from '../components/ConversationList';
import ModelSelector from '../components/ModelSelector';
import CostBadge from '../components/CostBadge';
import MarkdownRenderer from '../components/MarkdownRenderer';
import type { Message } from '../types/index';
import './CurrentTaskPage.css';

export default function CurrentTaskPage() {
  const navigate = useNavigate();
  const { conversations, create } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sending, error, send, cancel } = useStreamingChat(activeId);

  useEffect(() => {
    if (conversations.length > 0 && !activeId) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewConversation = async () => {
    const conv = await create('New conversation');
    setActiveId(conv.id);
  };

  const handleSend = (text: string) => {
    send(text, selectedModel === 'auto' ? undefined : selectedModel);
  };

  return (
    <div className="current-task">
      <button
        type="button"
        className="current-task__mobile-toggle"
        onClick={() => setSidebarOpen((v) => !v)}
      >
        {sidebarOpen ? 'Close' : 'History'}
      </button>

      {sidebarOpen && (
        <div className="current-task__sidebar-overlay" onClick={() => setSidebarOpen(false)}>
          <div className="current-task__sidebar" onClick={(e) => e.stopPropagation()}>
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                setSidebarOpen(false);
              }}
              onNew={handleNewConversation}
            />
          </div>
        </div>
      )}

      <div className="current-task__thread">
        {messages.length === 0 && (
          <div className="current-task__empty">
            <div className="current-task__empty-icon">I</div>
            <h2>What would you like to accomplish?</h2>
            <p>INT AI will route your request to the best specialists and models automatically.</p>
          </div>
        )}

        {messages.map((m: Message) => (
          <div key={m.id} className={`message message--${m.role}`}>
            <div className="message__bubble">
              {m.role === 'assistant' && !m.text && sending && (
                <div className="message__pending">
                  <span className="message__pending-dot" />
                  Thinking…
                </div>
              )}
              {m.role === 'assistant' && m.text && (
                <MarkdownRenderer content={m.text} />
              )}
              {m.role === 'user' && <span>{m.text}</span>}
              {m.role === 'assistant' && m.cost !== undefined && (
                <CostBadge tokens={m.tokens} cost={m.cost} />
              )}
            </div>
          </div>
        ))}

        {error && <div className="current-task__error">{error}</div>}

        <div ref={bottomRef} />
      </div>

      <div className="current-task__composer">
        <div className="composer">
          <div className="composer__inner">
            <div className="composer__box">
              <ComposerInput onSend={handleSend} disabled={sending} />
              <div className="composer__row">
                <div className="composer__controls">
                  <button type="button" className="composer__icon-button" aria-label="Add attachment">
                    +
                  </button>
                  <ModelSelector value={selectedModel} onChange={setSelectedModel} />
                </div>
                <div className="composer__actions">
                  {sending && (
                    <button type="button" className="composer__cancel" onClick={cancel}>
                      Cancel
                    </button>
                  )}
                  <SendButton disabled={!sending} onClick={() => {}} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComposerInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      className="composer__input"
      placeholder="Describe what you want to accomplish…"
      rows={1}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      disabled={disabled}
    />
  );
}

function SendButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="composer__send"
      disabled={disabled}
      aria-label="Send"
      onClick={onClick}
    >
      <span className="composer__send-icon" />
    </button>
  );
}
