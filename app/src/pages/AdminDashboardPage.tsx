import { useState, useEffect } from 'react';
import { fetchAdminStats } from '../../lib/api';
import type { AdminStats } from '../../types';
import './AdminDashboardPage.css';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminStats()
      .then((data: AdminStats) => setStats(data))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load admin stats'),
      )
      .finally(() => setLoading(false));
  }, []);

  const recentActivityEntries = stats
    ? Object.entries(stats.recentActivity).map(([date, cost]) => ({ date, cost }))
    : [];

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard__header">
        <h1 className="admin-dashboard__title">Admin Dashboard</h1>
        <p className="admin-dashboard__subtitle">Platform overview and analytics</p>
      </div>
      {loading ? (
        <div className="admin-dashboard__empty">Loading...</div>
      ) : error ? (
        <div className="admin-dashboard__empty">{error}</div>
      ) : stats ? (
        <>
          <div className="admin-dashboard__stats">
            <div className="admin-dashboard__stat">
              <div className="admin-dashboard__stat-label">Total Users</div>
              <div className="admin-dashboard__stat-value">{stats.totalUsers}</div>
            </div>
            <div className="admin-dashboard__stat">
              <div className="admin-dashboard__stat-label">Total Conversations</div>
              <div className="admin-dashboard__stat-value">{stats.totalConversations}</div>
            </div>
            <div className="admin-dashboard__stat">
              <div className="admin-dashboard__stat-label">Total Messages</div>
              <div className="admin-dashboard__stat-value">{stats.totalMessages}</div>
            </div>
            <div className="admin-dashboard__stat">
              <div className="admin-dashboard__stat-label">Total Cost</div>
              <div className="admin-dashboard__stat-value">${stats.totalCost.toFixed(2)}</div>
            </div>
            <div className="admin-dashboard__stat">
              <div className="admin-dashboard__stat-label">Active Specialists</div>
              <div className="admin-dashboard__stat-value">{stats.activeSpecialists}</div>
            </div>
            <div className="admin-dashboard__stat">
              <div className="admin-dashboard__stat-label">Total Teams</div>
              <div className="admin-dashboard__stat-value">{stats.totalTeams}</div>
            </div>
            <div className="admin-dashboard__stat">
              <div className="admin-dashboard__stat-label">Total Documents</div>
              <div className="admin-dashboard__stat-value">{stats.totalDocuments}</div>
            </div>
            <div className="admin-dashboard__stat">
              <div className="admin-dashboard__stat-label">Total Connections</div>
              <div className="admin-dashboard__stat-value">{stats.totalConnections}</div>
            </div>
          </div>

          <div className="admin-dashboard__section">
            <h2 className="admin-dashboard__section-title">Recent Activity (last 7 days)</h2>
            {recentActivityEntries.length === 0 ? (
              <div className="admin-dashboard__empty">No recent activity</div>
            ) : (
              <div className="admin-dashboard__list">
                {recentActivityEntries.slice(-7).map((activity) => (
                  <div key={activity.date} className="admin-dashboard__list-item">
                    <span>{activity.date}</span>
                    <span>${activity.cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-dashboard__section">
            <h2 className="admin-dashboard__section-title">Model Distribution</h2>
            {stats.modelDistribution.length === 0 ? (
              <div className="admin-dashboard__empty">No model data</div>
            ) : (
              <div className="admin-dashboard__list">
                {stats.modelDistribution.map((entry) => (
                  <div key={entry.model} className="admin-dashboard__list-item">
                    <span>{entry.model}</span>
                    <span>{entry.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
