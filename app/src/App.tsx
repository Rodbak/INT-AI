import { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Thread from './components/Thread';
import Composer from './components/Composer';
import type { LiveMessage } from './types';
import './App.css';

function App() {
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [sending, setSending] = useState(false);

  const handleSend = async (text: string) => {
    const userMessage: LiveMessage = { id: crypto.randomUUID(), role: 'user', text };
    const assistantId = crypto.randomUUID();
    const assistantMessage: LiveMessage = {
      id: assistantId,
      role: 'assistant',
      text: '',
      status: 'pending',
    };

    setLiveMessages((prev) => [...prev, userMessage, assistantMessage]);
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong.');
      }

      setLiveMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, text: data.reply, status: 'done' } : m,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setLiveMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, text: message, status: 'error' } : m)),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="app__main">
        <TopBar />
        <Thread liveMessages={liveMessages} />
        <Composer onSend={handleSend} disabled={sending} />
      </div>
    </div>
  );
}

export default App;
