// Lightweight, localStorage-backed user preferences. Single-user for now, so
// these live on the device rather than the server; when real auth/multi-tenancy
// lands these can move to a user_settings table without changing call sites.

export interface Preferences {
  defaultModel: string;
  displayName: string;
}

const STORAGE_KEY = 'int-ai:preferences';

const DEFAULTS: Preferences = {
  defaultModel: 'auto',
  displayName: '',
};

export function getPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return getPreferences()[key];
}

export function setPreferences(patch: Partial<Preferences>): Preferences {
  const next = { ...getPreferences(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — preferences won't persist, which is acceptable */
  }
  return next;
}
