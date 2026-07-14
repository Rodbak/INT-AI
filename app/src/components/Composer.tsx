import { useRef, useState } from 'react';
import './Composer.css';

interface ComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function Composer({ onSend, disabled = false }: ComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = value.trim().length > 0 && !disabled;

  const handleSend = () => {
    if (!canSend) return;
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
    <div className="composer">
      <div className="composer__inner">
        <div className="composer__box">
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
          <div className="composer__row">
            <div className="composer__controls">
              <button type="button" className="composer__icon-button" aria-label="Add attachment">
                +
              </button>
              <button type="button" className="composer__model-pill">
                Auto-select model
              </button>
            </div>
            <button
              type="button"
              className="composer__send"
              disabled={!canSend}
              aria-label="Send"
              onClick={handleSend}
            >
              <span className="composer__send-icon" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
