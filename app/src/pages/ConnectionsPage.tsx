import { useState, useEffect } from 'react';
import { fetchConnections } from '../../lib/api';
import type { Connection } from '../../types';
import './ConnectionsPage.css';

const PROVIDER_ICONS: Record<string, string> = {
  google: '🔍',
  microsoft: '📊',
  slack: '💬',
  github: '💻',
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConnections()
      .then(setConnections)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="connections">
      <div className="connections__header">
        <h1 className="connections__title">Connections</h1>
        <p className="connections__subtitle">External integrations and connected services</p>
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
