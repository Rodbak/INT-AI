import VoiceOrb from './VoiceOrb';
import { KeyboardIcon, MicIcon, StopIcon } from './icons';
import type { VoiceState } from '../hooks/useVoiceChat';
import './HandsFreeView.css';

const STATE_LABEL: Record<VoiceState, string> = {
  idle: 'Standing by',
  listening: 'Listening',
  transcribing: 'Transcribing',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

interface HandsFreeViewProps {
  voiceState: VoiceState;
  voiceError: string | null;
  micActive: boolean;
  getAudioLevel: () => number;
  powerUpTrigger: number;
  lastUserText: string;
  assistantText: string;
  interimText: string;
  onToggleMic: () => void;
  onInterrupt: () => void;
  onSwitchToType: () => void;
  modelLabel: string;
}

export default function HandsFreeView({
  voiceState,
  voiceError,
  micActive,
  getAudioLevel,
  powerUpTrigger,
  lastUserText,
  assistantText,
  interimText,
  onToggleMic,
  onInterrupt,
  onSwitchToType,
  modelLabel,
}: HandsFreeViewProps) {
  // While actively listening, surface the live (interim) transcript; once the
  // turn is captured, fall back to the last committed user utterance.
  const userLine = voiceState === 'listening' && interimText ? interimText : lastUserText;
  const hasConversation = Boolean(userLine || assistantText);

  return (
    <div className={`hands-free hands-free--${voiceState}`}>
      <div className="hands-free__aura" aria-hidden="true">
        <span className="hands-free__aura-ring hands-free__aura-ring--1" />
        <span className="hands-free__aura-ring hands-free__aura-ring--2" />
        <span className="hands-free__aura-ring hands-free__aura-ring--3" />
      </div>

      <div className="hands-free__hud">
        <div className="hands-free__hud-item">
          <span className={`hands-free__hud-dot hands-free__hud-dot--${voiceState}`} />
          {STATE_LABEL[voiceState].toUpperCase()}
        </div>
        <div className="hands-free__hud-item hands-free__hud-item--right">{modelLabel}</div>
      </div>

      <div className="hands-free__stage">
        <VoiceOrb voiceState={voiceState} getAudioLevel={getAudioLevel} powerUpTrigger={powerUpTrigger} />
      </div>

      <div className="hands-free__captions">
        {!hasConversation && (
          <p className="hands-free__hint">
            {micActive ? 'Say something to begin…' : 'Turn on the mic to start a hands-free conversation'}
          </p>
        )}
        {userLine && (
          <p className={`hands-free__caption hands-free__caption--user${voiceState === 'listening' && interimText ? ' hands-free__caption--live' : ''}`}>
            {userLine}
          </p>
        )}
        {assistantText && (
          <p className="hands-free__caption hands-free__caption--assistant">{assistantText}</p>
        )}
      </div>

      {voiceError && <div className="hands-free__error">{voiceError}</div>}

      <div className="hands-free__controls">
        <button
          type="button"
          className="hands-free__side-btn"
          onClick={onSwitchToType}
          title="Type instead"
          aria-label="Switch to type mode"
        >
          <KeyboardIcon className="hands-free__icon" />
        </button>

        <button
          type="button"
          className={`hands-free__mic${micActive ? ' hands-free__mic--active' : ''}`}
          onClick={onToggleMic}
          aria-pressed={micActive}
          title={micActive ? 'Turn off hands-free mode' : 'Turn on hands-free mode'}
          aria-label={micActive ? 'Turn off hands-free mode' : 'Turn on hands-free mode'}
        >
          <span className="hands-free__mic-halo" aria-hidden="true" />
          <MicIcon className="hands-free__icon hands-free__icon--mic" />
        </button>

        <button
          type="button"
          className={`hands-free__side-btn hands-free__side-btn--interrupt${voiceState === 'speaking' ? '' : ' hands-free__side-btn--hidden'}`}
          onClick={onInterrupt}
          title="Interrupt"
          aria-label="Interrupt"
          tabIndex={voiceState === 'speaking' ? 0 : -1}
        >
          <StopIcon className="hands-free__icon" />
        </button>
      </div>
    </div>
  );
}
