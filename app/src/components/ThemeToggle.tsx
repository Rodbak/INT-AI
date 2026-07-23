import { useState } from 'react';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';
import './ThemeToggle.css';

const ORDER: ThemePref[] = ['auto', 'light', 'dark'];

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
function AutoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
    </svg>
  );
}

const LABEL: Record<ThemePref, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' };

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(() => getThemePref());

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setPref(next);
    setThemePref(next);
  };

  return (
    <button type="button" className="theme-toggle" onClick={cycle} title={`Theme: ${LABEL[pref]} (click to change)`}>
      {pref === 'light' ? <SunIcon /> : pref === 'dark' ? <MoonIcon /> : <AutoIcon />}
      <span>{LABEL[pref]}</span>
    </button>
  );
}
