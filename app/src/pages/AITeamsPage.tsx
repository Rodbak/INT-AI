import { useState, useEffect } from 'react';
import { fetchTeams } from '../lib/api';
import type { AITeam } from '../types/index';
import './AITeamsPage.css';

export default function AITeamsPage() {
  const [teams, setTeams] = useState<AITeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams()
      .then(setTeams)
      .catch((err) => console.error('Failed to load teams:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ai-teams">
      <div className="ai-teams__header">
        <h1 className="ai-teams__title">AI Teams</h1>
        <p className="ai-teams__subtitle">Collaborative teams of AI specialists</p>
      </div>
      {loading ? (
        <div className="ai-teams__empty">Loading...</div>
      ) : teams.length === 0 ? (
        <div className="ai-teams__empty">No teams yet</div>
      ) : (
        <div className="ai-teams__grid">
          {teams.map((team) => (
            <div key={team.id} className="ai-teams__card">
              <div className="ai-teams__card-title">{team.name}</div>
              {team.description && <p className="ai-teams__card-desc">{team.description}</p>}
              <div className="ai-teams__card-meta">
                {team.members.length} specialists · {team.workspace.name}
              </div>
              <div className="ai-teams__members">
                {team.members.map((member: { id: string; specialist: { id: string; name: string; role: string } }) => (
                  <span key={member.id} className="ai-teams__member">
                    {member.specialist.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
