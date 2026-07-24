import { Navigate, useParams } from 'react-router-dom';

// The old standalone conversation view is gone — past chats now open inside the
// full Ask INT experience. Redirect any lingering /conversations/:id links there.
export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/current-task?conv=${id}` : '/current-task'} replace />;
}
