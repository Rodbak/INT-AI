export type ThemePref = 'auto' | 'light' | 'dark';

const KEY = 'int-theme';

export function getThemePref(): ThemePref {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  return v === 'light' || v === 'dark' ? v : 'auto';
}

/** Apply a preference: 'auto' follows the OS (no attribute), light/dark force it. */
export function applyTheme(pref: ThemePref) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (pref === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  applyTheme(pref);
}

export function initTheme() {
  applyTheme(getThemePref());
}
