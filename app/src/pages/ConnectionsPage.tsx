import { useState, useEffect } from 'react';
import { fetchConnections, initiateOAuth } from '../lib/api';
import type { Connection } from '../types/index';
import './ConnectionsPage.css';

const PROVIDER_ICONS: Record<string, string> = {
  google: '🔍',
  microsoft: '📊',
  slack: '💬',
  github: '💻',
};

const SUPPORTED_PROVIDERS = [
  { id: 'google', name: 'Google', icon: '🔍' },
  { id: 'microsoft', name: 'Microsoft', icon: '📊' },
  { id: 'slack', name: 'Slack', icon: '💬' },
  { id: 'github', name: 'GitHub', icon: '💻' },
];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections()
      .then(setConnections)
      .catch((err) => console.error('Failed to load connections:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async (provider: string) => {
    setConnecting(provider);
    try {
      const workspaceId = 'default';
      const { authUrl } = await initiateOAuth(provider, workspaceId);
      window.location.href = authUrl;
    } catch (err) {
      console.error('Failed to initiate OAuth:', err);
      setConnecting(null);
    }
  };

  const connectedProviders = new Set(connections.map((c) => c.provider.toLowerCase()));

  return (
    <div className="connections">
      <div className="connections__header">
        <h1 className="connections__title">Connections</h1>
        <p className="connections__subtitle">External integrations and connected services</p>
      </div>

      <div className="connections__grid">
        {SUPPORTED_PROVIDERS.map((provider) => {
          const isConnected = connectedProviders.has(provider.id);
          return (
            <div key={provider.id} className="connections__card">
              <div className="connections__card-icon">{provider.icon}</div>
              <div className="connections__card-name">{provider.name}</div>
              <div className="connections__card-status">
                {isConnected ? 'Connected' : 'Not connected'}
              </div>
              {!isConnected && (
                <button
                  type="button"
                  className="connections__card-button"
                  onClick={() => handleConnect(provider.id)}
                  disabled={connecting === provider.id}
                >
                  {connecting === provider.id ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="connections__empty">Loading...</div>
      ) : connections.length === 0 ? (
        <div className="connections__empty">No external connections yet</div>
      ) : (
        <div className="connections__list">
          {connections.map((conn) => {
            const provider = conn.provider.toLowerCase();
            return (
              <div key={conn.id} className="connections__item">
                <div className="connections__icon">
                  {PROVIDER_ICONS[provider] ?? '🔗'}
                </div>
                <div className="connections__info">
                  <div className="connections__provider">{capitalize(conn.provider)}</div>
                  <div className="connections__name">{conn.name}</div>
                  <div className="connections__workspace">{conn.workspace.name}</div>
                  {conn.expiresAt && (
                    <div className="connections__expiry">
                      Expires {new Date(conn.expiresAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <span className={`connections__status connections__status--${conn.status}`}>
                  {conn.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
