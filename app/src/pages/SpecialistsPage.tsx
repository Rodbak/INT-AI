import { useState, useEffect } from 'react';
import { fetchSpecialists } from '../../lib/api';
import type { Specialist } from '../../types';
import './SpecialistsPage.css';

export default function SpecialistsPage() {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecialists()
      .then(setSpecialists)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="specialists">
      <div className="specialists__header">
        <h1 className="specialists__title">Specialists</h1>
        <p className="specialists__subtitle">Manage your AI specialists</p>
      </div>
      {loading ? (
        <div className="specialists__empty">Loading...</div>
      ) : (
        <div className="specialists__grid">
          {specialists.map((s) => (
            <div key={s.id} className="specialists__card">
              <div className="specialists__card-header">
                <div className="specialists__avatar">{s.name[0]}</div>
                <span className={`specialists__status specialists__status--${s.status}`}>{s.status}</span>
              </div>
              <div className="specialists__name">{s.name}</div>
              <div className="specialists__role">{s.role}</div>
              <div className="specialists__model">{s.model}</div>
              <p className="specialists__desc">{s.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
