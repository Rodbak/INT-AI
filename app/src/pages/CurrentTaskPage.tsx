import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { useConversations } from '../hooks/useConversations';
import { useVoiceChat } from '../hooks/useVoiceChat';
import ConversationList from '../components/ConversationList';
import ModelSelector from '../components/ModelSelector';
import CostBadge from '../components/CostBadge';
import MarkdownRenderer from '../components/MarkdownRenderer';
import HandsFreeView from '../components/HandsFreeView';
import { MicIcon, PlusIcon } from '../components/icons';
import type { Message } from '../types/index';
import '../components/Composer.css';
import './CurrentTaskPage.css';

type Mode = 'voice' | 'type';

export default function CurrentTaskPage() {
  const { conversations, create } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [composerValue, setComposerValue] = useState('');
  const [mode, setMode] = useState<Mode>('type');
  const [displayedMode, setDisplayedMode] = useState<Mode>('type');
  const [transitioning, setTransitioning] = useState(false);
  const [powerUpTrigger, setPowerUpTrigger] = useState(0);
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

  // Cross-fade between hands-free and type mode instead of an instant swap:
  // fade the current content out, swap what's rendered, then fade the new
  // content in.
  useEffect(() => {
    if (mode === displayedMode) return;
    setTransitioning(true);
    const outTimer = window.setTimeout(() => {
      setDisplayedMode(mode);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTransitioning(false));
      });
    }, 280);
    return () => window.clearTimeout(outTimer);
  }, [mode, displayedMode]);

  // Play the orb's boot-up burst whenever hands-free mode becomes visible —
  // on first load and whenever switching back from type mode.
  useEffect(() => {
    if (displayedMode === 'voice') {
      setPowerUpTrigger(Date.now());
    }
  }, [displayedMode]);

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

  // Play the orb's "power up" burst exactly when the mic transitions off -> on.
  const wasMicActiveRef = useRef(false);
  useEffect(() => {
    if (voiceChat.active && !wasMicActiveRef.current) {
      setPowerUpTrigger(Date.now());
    }
    wasMicActiveRef.current = voiceChat.active;
  }, [voiceChat.active]);

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

  const switchToType = useCallback(() => {
    if (voiceChat.active) voiceChat.stop();
    setMode('type');
  }, [voiceChat]);

  const switchToVoice = useCallback(async () => {
    if (!activeId) {
      await handleNewConversation();
    }
    setMode('voice');
    voiceChat.start();
  }, [activeId, handleNewConversation, voiceChat]);

  // Leaving the page entirely should release the mic, even if the user
  // never explicitly switched to type mode first.
  useEffect(() => {
    return () => {
      if (voiceChat.active) voiceChat.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastUserText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].text;
    }
    return '';
  }, [messages]);

  const lastAssistantText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].text;
    }
    return '';
  }, [messages]);

  const submitComposer = () => {
    if (!composerValue.trim() || sending) return;
    handleSend(composerValue.trim());
    setComposerValue('');
  };

  return (
    <div className={`current-task${displayedMode === 'voice' ? ' current-task--voice' : ''}`}>
      {displayedMode === 'type' && (
        <>
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
        </>
      )}

      <div className={`current-task__stage${transitioning ? ' current-task__stage--transitioning' : ''}`}>
        {displayedMode === 'voice' ? (
          <HandsFreeView
            voiceState={voiceChat.voiceState}
            voiceError={voiceChat.voiceError}
            micActive={voiceChat.active}
            getAudioLevel={voiceChat.getAudioLevel}
            powerUpTrigger={powerUpTrigger}
            lastUserText={lastUserText}
            assistantText={lastAssistantText}
            onToggleMic={handleToggleVoice}
            onInterrupt={voiceChat.interrupt}
            onSwitchToType={switchToType}
            modelLabel={selectedModel === 'auto' ? 'AUTO ROUTING' : selectedModel.toUpperCase()}
          />
        ) : (
          <div className="current-task__body">
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
                    <ComposerInput
                      value={composerValue}
                      onChange={setComposerValue}
                      onSubmit={submitComposer}
                      disabled={sending}
                    />
                    <div className="composer__row">
                      <div className="composer__controls">
                        <button type="button" className="composer__icon-button" aria-label="Add attachment" title="Add attachment">
                          <PlusIcon className="composer__icon" />
                        </button>
                        <button
                          type="button"
                          className="composer__icon-button composer__mic"
                          aria-label="Switch to hands-free mode"
                          title="Switch to hands-free mode"
                          onClick={switchToVoice}
                        >
                          <MicIcon className="composer__icon" />
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
        )}
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
