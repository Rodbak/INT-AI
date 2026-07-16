import VoiceOrb from './VoiceOrb';
import { KeyboardIcon, MicIcon, StopIcon } from './icons';
import type { VoiceState } from '../hooks/useVoiceChat';
import './HandsFreeView.css';

const STATE_LABEL: Record<VoiceState, string> = {
  idle: 'Standing by — say something',
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
  onToggleMic,
  onInterrupt,
  onSwitchToType,
  modelLabel,
}: HandsFreeViewProps) {
  return (
    <div className="hands-free">
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
        {!lastUserText && !assistantText && (
          <p className="hands-free__hint">
            {micActive ? 'Say something to begin' : 'Turn on the mic to start a hands-free conversation'}
          </p>
        )}
        {lastUserText && <p className="hands-free__caption hands-free__caption--user">{lastUserText}</p>}
        {assistantText && (
          <p className="hands-free__caption hands-free__caption--assistant">{assistantText}</p>
        )}
      </div>

      {voiceError && <div className="hands-free__error">{voiceError}</div>}

      <div className="hands-free__controls">
        <button
          type="button"
          className="hands-free__mode-switch"
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
          <MicIcon className="hands-free__icon hands-free__icon--mic" />
        </button>

        {voiceState === 'speaking' ? (
          <button
            type="button"
            className="hands-free__interrupt"
            onClick={onInterrupt}
            title="Interrupt"
            aria-label="Interrupt"
          >
            <StopIcon className="hands-free__icon" />
          </button>
        ) : (
          <span className="hands-free__controls-spacer" />
        )}
      </div>
    </div>
  );
}
