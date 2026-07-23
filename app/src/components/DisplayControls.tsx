import { useState } from 'react';
import { getBigText, getHighContrast, setBigText, setHighContrast } from '../lib/display';
import './DisplayControls.css';

function Toggle({ on, onClick, label, icon }: { on: boolean; onClick: () => void; label: string; icon: string }) {
  return (
    <button type="button" className={`disp__toggle${on ? ' disp__toggle--on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className="disp__icon" aria-hidden>{icon}</span>
      <span className="disp__label">{label}</span>
      <span className="disp__switch" aria-hidden><span className="disp__knob" /></span>
    </button>
  );
}

/** Big-text and high-contrast toggles — for bright sunlight and easier reading. */
export default function DisplayControls() {
  const [big, setBig] = useState(getBigText());
  const [contrast, setContrast] = useState(getHighContrast());
  return (
    <div className="disp">
      <Toggle
        on={big}
        icon="A"
        label="Bigger text"
        onClick={() => { const v = !big; setBig(v); setBigText(v); }}
      />
      <Toggle
        on={contrast}
        icon="◑"
        label="High contrast"
        onClick={() => { const v = !contrast; setContrast(v); setHighContrast(v); }}
      />
    </div>
  );
}
