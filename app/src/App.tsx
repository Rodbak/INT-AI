import { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Thread from './components/Thread';
import Composer from './components/Composer';
import type { LiveMessage } from './types/index';
import './App.css';

function App() {
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [sending, setSending] = useState(false);

  return (
    <div className="app">
      <Sidebar />
      <div className="app__main">
        <TopBar />
        <Thread liveMessages={liveMessages} />
        <Composer onSend={async (text) => {}} disabled={sending} />
      </div>
    </div>
  );
}

export default App;
