import UserBubble from './thread/UserBubble';
import AssistantMessage from './thread/AssistantMessage';
import LiveAssistantMessage from './thread/LiveAssistantMessage';
import type { LiveMessage } from '../types/index';
import './Thread.css';

interface ThreadProps {
  liveMessages: LiveMessage[];
}

export default function Thread({ liveMessages }: ThreadProps) {
  return (
    <div className="thread">
      <div className="thread__inner">
        {liveMessages.map((m) =>
          m.role === 'user' ? (
            <UserBubble key={m.id} text={m.text} />
          ) : (
            <LiveAssistantMessage key={m.id} status={m.status ?? 'done'} text={m.text} />
          ),
        )}
      </div>
    </div>
  );
}
