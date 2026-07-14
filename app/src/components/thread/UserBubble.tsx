import './UserBubble.css';

export default function UserBubble({ text }: { text: string }) {
  return <div className="user-bubble">{text}</div>;
}
