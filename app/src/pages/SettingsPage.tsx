import { useState, useEffect } from 'react';
import { authManager } from '../lib/auth';
import './SettingsPage.css';

export default function SettingsPage() {
  const [user, setUser] = useState(authManager.getState().user);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = authManager.subscribe(() => {
      setUser(authManager.getState().user);
    });
    return unsubscribe;
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    // In a real implementation, call an API endpoint to update the profile
    setTimeout(() => {
      setMessage('Profile updated (demo)');
      setSaving(false);
    }, 500);
  };

  return (
    <div className="settings">
      <div className="settings__header">
        <h1 className="settings__title">Settings</h1>
        <p className="settings__subtitle">Manage your profile and preferences</p>
      </div>

      <div className="settings__section">
        <h2 className="settings__section-title">Profile</h2>
        <div className="settings__field">
          <label className="settings__label">Email</label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="settings__input"
          />
        </div>
        <div className="settings__field">
          <label className="settings__label">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="settings__input"
          />
        </div>
        <button
          type="button"
          className="settings__button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {message && <div className="settings__message">{message}</div>}
      </div>

      <div className="settings__section">
        <h2 className="settings__section-title">Workspace</h2>
        <p className="settings__text">Workspace management coming soon.</p>
      </div>

      <div className="settings__section">
        <h2 className="settings__section-title">Danger Zone</h2>
        <button
          type="button"
          className="settings__button settings__button--danger"
          onClick={() => {
            window.location.href = '/current-task';
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
