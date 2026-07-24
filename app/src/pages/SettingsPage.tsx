import { useState, useEffect } from 'react';
import { authManager } from '../lib/auth';
import { supabase } from '../lib/supabaseClient';
import { getPreferences, setPreferences } from '../lib/preferences';
import { MODELS } from '../components/ModelSelector';
import CreditsSection from '../components/CreditsSection';
import './SettingsPage.css';

export default function SettingsPage() {
  const [user, setUser] = useState(authManager.getState().user);
  const initial = getPreferences();
  const [displayName, setDisplayName] = useState(initial.displayName || user?.name || '');
  const [defaultModel, setDefaultModel] = useState(initial.defaultModel);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = authManager.subscribe(() => {
      setUser(authManager.getState().user);
    });
    return unsubscribe;
  }, []);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2500);
  };

  const saveProfile = () => {
    setPreferences({ displayName: displayName.trim() });
    flash('Saved.');
  };

  const changeDefaultModel = (value: string) => {
    setDefaultModel(value);
    setPreferences({ defaultModel: value });
    flash('Default model updated.');
  };

  const signOut = async () => {
    await supabase.auth.signOut().catch(() => {});
    window.location.href = '/login';
  };

  return (
    <div className="settings">
      <div className="settings__header">
        <h1 className="settings__title">Settings</h1>
        <p className="settings__subtitle">Manage your profile and preferences</p>
      </div>

      {message && <div className="settings__message">{message}</div>}

      {/* AI credits wallet (only shows when billing is switched on) */}
      <CreditsSection />

      <div className="settings__section">
        <h2 className="settings__section-title">Profile</h2>
        <div className="settings__field">
          <label className="settings__label">Email</label>
          <input type="email" value={user?.email || ''} disabled className="settings__input" />
        </div>
        <div className="settings__field">
          <label className="settings__label">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="settings__input"
            placeholder="How you'd like to be addressed"
          />
        </div>
        <button type="button" className="settings__button" onClick={saveProfile}>
          Save changes
        </button>
      </div>

      <div className="settings__section">
        <h2 className="settings__section-title">Preferences</h2>
        <div className="settings__field">
          <label className="settings__label">Default model</label>
          <select
            className="settings__input"
            value={defaultModel}
            onChange={(e) => changeDefaultModel(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <p className="settings__hint">
            New conversations start with this model selected. “Auto-select” lets the routing engine choose.
          </p>
        </div>
      </div>

      <div className="settings__section">
        <h2 className="settings__section-title">Account</h2>
        <button type="button" className="settings__button settings__button--danger" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
