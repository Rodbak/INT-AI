// Audience-fit display preferences: bigger text and a high-contrast mode for
// bright outdoor use and older eyes. Applied as attributes on <html> so plain
// CSS (see index.css) does the rest. Mirrors lib/theme.ts.
const BIG_KEY = 'int-bigtext';
const CONTRAST_KEY = 'int-contrast';

export function getBigText(): boolean {
  try { return localStorage.getItem(BIG_KEY) === 'on'; } catch { return false; }
}
export function getHighContrast(): boolean {
  try { return localStorage.getItem(CONTRAST_KEY) === 'on'; } catch { return false; }
}

export function applyDisplay() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (getBigText()) root.setAttribute('data-bigtext', 'on'); else root.removeAttribute('data-bigtext');
  if (getHighContrast()) root.setAttribute('data-contrast', 'high'); else root.removeAttribute('data-contrast');
}

export function setBigText(on: boolean) {
  try { localStorage.setItem(BIG_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
  applyDisplay();
}
export function setHighContrast(on: boolean) {
  try { localStorage.setItem(CONTRAST_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
  applyDisplay();
}

export function initDisplay() { applyDisplay(); }
