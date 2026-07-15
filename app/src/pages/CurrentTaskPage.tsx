import { useState, useRef, useEffect, useCallback } from 'react';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { useConversations } from '../hooks/useConversations';
import { useVoiceChat } from '../hooks/useVoiceChat';
import ConversationList from '../components/ConversationList';
import ModelSelector from '../components/ModelSelector';
import CostBadge from '../components/CostBadge';
import MarkdownRenderer from '../components/MarkdownRenderer';
import type { Message } from '../types/index';
import '../components/Composer.css';
import './CurrentTaskPage.css';

const VOICE_STATUS_LABEL: Record<string, string> = {
  listening: 'Listening…',
  transcribing: 'Transcribing…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

export default function CurrentTaskPage() {
  const { conversations, create } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [composerValue, setComposerValue] = useState('');
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

  const handleNewConversation = useCallback(async () => {
    const conv = await create('New conversation');
    setActiveId(conv.id);
    return conv;
  }, [create]);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      send(text, selectedModel === 'auto' ? undefined : selectedModel);
    },
    [send, selectedModel],
  );

  const handleVoiceTranscript = useCallback(
    async (text: string) => {
      const result = await send(text, selectedModel === 'auto' ? undefined : selectedModel);
      return result?.message.text;
    },
    [send, selectedModel],
  );

  const voiceChat = useVoiceChat({ onTranscript: handleVoiceTranscript });

  const handleToggleVoice = useCallback(async () => {
    if (!voiceChat.active) {
      if (!activeId) {
        await handleNewConversation();
      }
      voiceChat.toggle();
    } else {
      voiceChat.toggle();
    }
  }, [voiceChat, activeId, handleNewConversation]);

  const submitComposer = () => {
    if (!composerValue.trim() || sending) return;
    handleSend(composerValue.trim());
    setComposerValue('');
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
        {voiceChat.active && (
          <div className="voice-status">
            <span className={`voice-status__dot voice-status__dot--${voiceChat.voiceState}`} />
            {VOICE_STATUS_LABEL[voiceChat.voiceState] || 'Voice mode on'}
            {voiceChat.voiceState === 'speaking' && (
              <button type="button" className="voice-status__interrupt" onClick={voiceChat.interrupt}>
                Interrupt
              </button>
            )}
          </div>
        )}
        {voiceChat.voiceError && <div className="current-task__error">{voiceChat.voiceError}</div>}

        <div className="composer">
          <div className="composer__inner">
            <div className="composer__box">
              <ComposerInput
                value={composerValue}
                onChange={setComposerValue}
                onSubmit={submitComposer}
                disabled={sending}
              />
              <div className="composer__row">
                <div className="composer__controls">
                  <button type="button" className="composer__icon-button" aria-label="Add attachment">
                    +
                  </button>
                  <button
                    type="button"
                    className={`composer__icon-button composer__mic${voiceChat.active ? ' composer__mic--active' : ''}`}
                    aria-label={voiceChat.active ? 'Turn off voice mode' : 'Turn on voice mode'}
                    aria-pressed={voiceChat.active}
                    onClick={handleToggleVoice}
                  >
                    🎙
                  </button>
                  <ModelSelector value={selectedModel} onChange={setSelectedModel} />
                </div>
                <div className="composer__actions">
                  {sending && (
                    <button type="button" className="composer__cancel" onClick={cancel}>
                      Cancel
                    </button>
                  )}
                  <SendButton disabled={sending || !composerValue.trim()} onClick={submitComposer} />
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
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) {
        onSubmit();
        textareaRef.current?.focus();
      }
    }
  };

  return (
    <textarea
      ref={textareaRef}
      className="composer__input"
      placeholder="Describe what you want to accomplish…"
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
