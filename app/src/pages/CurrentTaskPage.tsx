import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { useConversations } from '../hooks/useConversations';
import { useVoiceChat } from '../hooks/useVoiceChat';
import ConversationList from '../components/ConversationList';
import ModelSelector, { MODELS } from '../components/ModelSelector';
import SpecialistSelector from '../components/SpecialistSelector';
import PromptPicker from '../components/PromptPicker';
import { fetchSpecialists } from '../lib/api';
import type { Specialist } from '../types/index';
import CostBadge from '../components/CostBadge';
import MarkdownRenderer from '../components/MarkdownRenderer';
import HandsFreeView from '../components/HandsFreeView';
import { MicIcon, PlusIcon, CopyIcon, CheckIcon, RegenerateIcon, EditIcon } from '../components/icons';
import { getPreference } from '../lib/preferences';
import { drainSentences } from '../lib/speech';
import type { Message } from '../types/index';
import '../components/Composer.css';
import './CurrentTaskPage.css';

type Mode = 'voice' | 'type';

export default function CurrentTaskPage() {
  const { conversations, create, rename } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(() => getPreference('defaultModel'));
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [selectedSpecialist, setSelectedSpecialist] = useState('auto');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [composerValue, setComposerValue] = useState('');
  const [mode, setMode] = useState<Mode>('type');
  const [displayedMode, setDisplayedMode] = useState<Mode>('type');
  const [transitioning, setTransitioning] = useState(false);
  const [powerUpTrigger, setPowerUpTrigger] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sending, error, send, regenerate, popLastUserMessage, cancel } =
    useStreamingChat(activeId);
  const composerRef = useRef<HTMLTextAreaElement>(null);

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

  const handleNewConversation = useCallback(
    async (title = 'New conversation') => {
      const conv = await create(title);
      setActiveId(conv.id);
      return conv;
    },
    [create],
  );

  useEffect(() => {
    fetchSpecialists()
      .then(setSpecialists)
      .catch(() => {});
  }, []);

  const selectedProvider = useMemo(
    () => (selectedModel === 'auto' ? undefined : MODELS.find((m) => m.id === selectedModel)?.provider),
    [selectedModel],
  );

  // 'none' means send no specialist; 'auto' lets the server pick; else an id.
  const specialistId = selectedSpecialist === 'none' ? undefined : selectedSpecialist;

  // A conversation's title is derived from its opening message the first time
  // one is sent — trimmed to a sensible length on a word boundary.
  const deriveTitle = useCallback((text: string) => {
    const clean = text.trim().replace(/\s+/g, ' ');
    if (clean.length <= 48) return clean;
    const cut = clean.slice(0, 48);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim()}…`;
  }, []);

  // Title a conversation from its opening message. Fires on the first message
  // whether the conversation was created implicitly here or already existed
  // empty (e.g. started via the "+" button, which titles it "New conversation").
  const titleFromFirstMessage = useCallback(
    (conversationId: string, text: string) => {
      if (messages.length === 0) {
        rename(conversationId, deriveTitle(text));
      }
    },
    [messages.length, rename, deriveTitle],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      const conversationId = activeId || (await handleNewConversation(deriveTitle(text))).id;
      titleFromFirstMessage(conversationId, text);
      send(text, selectedModel === 'auto' ? undefined : selectedModel, selectedProvider, conversationId, specialistId);
    },
    [send, selectedModel, selectedProvider, activeId, handleNewConversation, deriveTitle, titleFromFirstMessage, specialistId],
  );

  const handleVoiceTranscript = useCallback(
    async (text: string, speak: (sentence: string) => void) => {
      const conversationId = activeId || (await handleNewConversation(deriveTitle(text))).id;
      titleFromFirstMessage(conversationId, text);
      // Speak the reply sentence-by-sentence as it streams, so the voice starts
      // almost immediately instead of waiting for the whole answer.
      let buffer = '';
      await send(
        text,
        selectedModel === 'auto' ? undefined : selectedModel,
        selectedProvider,
        conversationId,
        specialistId,
        (chunk) => {
          buffer += chunk;
          const { sentences, rest } = drainSentences(buffer);
          buffer = rest;
          sentences.forEach(speak);
        },
      );
      const { sentences } = drainSentences(buffer, true);
      sentences.forEach(speak);
    },
    [send, selectedModel, selectedProvider, activeId, handleNewConversation, deriveTitle, titleFromFirstMessage, specialistId],
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

  // Ids of the last user / last assistant messages — regenerate and edit only
  // apply to the most recent turn.
  const lastUserId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].id;
    }
    return null;
  }, [messages]);

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  }, [messages]);

  const handleRegenerate = useCallback(() => {
    regenerate(selectedModel === 'auto' ? undefined : selectedModel, selectedProvider, specialistId);
  }, [regenerate, selectedModel, selectedProvider, specialistId]);

  const handleEditLast = useCallback(() => {
    if (sending) return;
    const text = popLastUserMessage();
    if (text !== undefined) {
      setComposerValue(text);
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  }, [popLastUserMessage, sending]);

  // Keyboard shortcuts: Cmd/Ctrl+K starts a new conversation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewConversation();
        requestAnimationFrame(() => composerRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNewConversation]);

  return (
    <div className={`current-task${displayedMode === 'voice' ? ' current-task--voice' : ''}`}>
      {displayedMode === 'type' && (
        <>
          {/* Persistent sidebar on desktop; collapses to the toggle+overlay below on mobile. */}
          <aside className="current-task__sidebar-panel">
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={(id) => setActiveId(id)}
              onNew={() => handleNewConversation()}
            />
          </aside>

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
                  onNew={() => handleNewConversation()}
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
            interimText={voiceChat.interimText}
            onToggleMic={handleToggleVoice}
            onInterrupt={voiceChat.interrupt}
            onSwitchToType={switchToType}
            modelLabel={selectedModel === 'auto' ? 'AUTO ROUTING' : selectedModel.toUpperCase()}
            usesBrowserSpeech={voiceChat.usesBrowserSpeech}
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

              {messages.map((m: Message) => {
                const isStreamingHere = m.id === lastAssistantId && sending;
                return (
                  <div key={m.id} className={`message message--${m.role}`}>
                    {m.role === 'assistant' && m.specialist && (
                      <div className="message__specialist">
                        <span className="message__specialist-node" aria-hidden="true" />
                        {m.specialist.name}
                      </div>
                    )}
                    <div className="message__bubble">
                      {m.role === 'assistant' && !m.text && sending && (
                        <div className="message__pending">
                          <span className="message__pending-dot" />
                          Thinking…
                        </div>
                      )}
                      {m.role === 'assistant' && m.text && <MarkdownRenderer content={m.text} />}
                      {m.role === 'user' && <span>{m.text}</span>}
                      {m.role === 'assistant' && m.cost !== undefined && (
                        <CostBadge tokens={m.tokens} cost={m.cost} />
                      )}
                    </div>
                    {m.text && !isStreamingHere && (
                      <MessageActions
                        text={m.text}
                        canEdit={m.role === 'user' && m.id === lastUserId && !sending}
                        canRegenerate={m.role === 'assistant' && m.id === lastAssistantId && !sending}
                        onEdit={handleEditLast}
                        onRegenerate={handleRegenerate}
                      />
                    )}
                  </div>
                );
              })}

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
                      inputRef={composerRef}
                    />
                    <div className="composer__row">
                      <div className="composer__controls">
                        <PromptPicker
                          onPick={(content) => {
                            setComposerValue(content);
                            requestAnimationFrame(() => composerRef.current?.focus());
                          }}
                        />
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
                        <SpecialistSelector
                          specialists={specialists}
                          value={selectedSpecialist}
                          onChange={setSelectedSpecialist}
                        />
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
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? internalRef;

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

function MessageActions({
  text,
  canEdit,
  canRegenerate,
  onEdit,
  onRegenerate,
}: {
  text: string;
  canEdit: boolean;
  canRegenerate: boolean;
  onEdit: () => void;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  return (
    <div className="message__actions">
      <button
        type="button"
        className="message__action"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy message'}
        title={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <CheckIcon className="message__action-icon" /> : <CopyIcon className="message__action-icon" />}
      </button>
      {canRegenerate && (
        <button
          type="button"
          className="message__action"
          onClick={onRegenerate}
          aria-label="Regenerate reply"
          title="Regenerate"
        >
          <RegenerateIcon className="message__action-icon" />
        </button>
      )}
      {canEdit && (
        <button
          type="button"
          className="message__action"
          onClick={onEdit}
          aria-label="Edit message"
          title="Edit"
        >
          <EditIcon className="message__action-icon" />
        </button>
      )}
    </div>
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
