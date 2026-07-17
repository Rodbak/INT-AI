import { useState, useEffect } from 'react';
import { fetchAutomations } from '../lib/api';
import type { Automation } from '../types/index';
import './AutomationsPage.css';

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAutomations()
      .then(setAutomations)
      .catch((err) => console.error('Failed to load automations:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="automations">
      <div className="automations__header">
        <h1 className="automations__title">Automations</h1>
        <p className="automations__subtitle">Workflows and triggers</p>
      </div>
      {loading ? (
        <div className="automations__empty">Loading...</div>
      ) : automations.length === 0 ? (
        <div className="automations__empty">No automations yet</div>
      ) : (
        <div className="automations__list">
          {automations.map((automation) => (
            <div key={automation.id} className="automations__item">
              <div className="automations__item-info">
                <div className="automations__item-title">
                  {automation.name}
                  <span className="automations__trigger">{automation.trigger}</span>
                </div>
                {automation.description && (
                  <div className="automations__item-desc">{automation.description}</div>
                )}
                <span className={`automations__status automations__status--${automation.active ? 'active' : 'inactive'}`}>
                  {automation.active ? 'active' : 'inactive'}
                </span>
                <div className="automations__item-desc">{automation.workspace.name}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
