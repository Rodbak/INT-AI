import './LiveAssistantMessage.css';

interface LiveAssistantMessageProps {
  status: 'pending' | 'done' | 'error';
  text: string;
}

export default function LiveAssistantMessage({ status, text }: LiveAssistantMessageProps) {
  return (
    <div className="assistant-message">
      <div className="assistant-message__avatar" />
      <div className="assistant-message__content">
        {status === 'pending' && (
          <div className="live-message__pending">
            <span className="live-message__pending-dot" />
            Thinking…
          </div>
        )}
        {status === 'done' && <div className="live-message__text">{text}</div>}
        {status === 'error' && <div className="live-message__error">{text}</div>}
      </div>
    </div>
  );
}
