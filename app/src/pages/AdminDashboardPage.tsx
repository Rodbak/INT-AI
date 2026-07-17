import { useState, useEffect } from 'react';
import { fetchAdminStats, fetchAdminUsers, updateAdminUser, deleteAdminUser } from '../lib/api';
import type { AdminStats } from '../types/index';
import './AdminDashboardPage.css';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    loadStats();
    loadUsers();
  }, [search, roleFilter]);

  const loadStats = async () => {
    try {
      const data = await fetchAdminStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin stats');
    }
  };

  const loadUsers = async () => {
    try {
      const data = await fetchAdminUsers(1, 20, search, roleFilter);
      setUsers(data.users);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateAdminUser(userId, { role });
      loadUsers();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user?')) return;
    try {
      await deleteAdminUser(userId);
      loadUsers();
    } catch {
      // ignore
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard__header">
        <h1 className="admin-dashboard__title">Admin Dashboard</h1>
        <p className="admin-dashboard__subtitle">Platform overview and analytics</p>
      </div>

      {loading ? (
        <div className="admin-dashboard__empty">Loading...</div>
      ) : error ? (
        <div className="admin-dashboard__empty admin-dashboard__empty--error">{error}</div>
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
            <h2 className="admin-dashboard__section-title">Users</h2>
            <div className="admin-dashboard__filters">
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="admin-dashboard__search"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="admin-dashboard__select"
              >
                <option value="">All roles</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="admin-dashboard__table">
              <div className="admin-dashboard__table-header">
                <div>Email</div>
                <div>Name</div>
                <div>Role</div>
                <div>Created</div>
                <div>Actions</div>
              </div>
              {users.map((user) => (
                <div key={user.id} className="admin-dashboard__table-row">
                  <div>{user.email}</div>
                  <div>{user.name || '-'}</div>
                  <div>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="admin-dashboard__role-select"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>{new Date(user.createdAt).toLocaleDateString()}</div>
                  <div>
                    <button
                      type="button"
                      onClick={() => handleDelete(user.id)}
                      className="admin-dashboard__button--danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-dashboard__section">
            <h2 className="admin-dashboard__section-title">Recent Activity (last 7 days)</h2>
            {stats.recentActivity.length === 0 ? (
              <div className="admin-dashboard__empty">No recent activity</div>
            ) : (
              <div className="admin-dashboard__list">
                {stats.recentActivity.map((activity) => (
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
