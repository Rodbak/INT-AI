import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authManager } from '../../lib/auth';
import { navGroups, defaultActiveNavId } from '../../data/workspace';
import './Sidebar.css';

export default function Sidebar() {
  const navigate = useNavigate();
  const path = window.location.pathname;
  const activeId = useMemo(() => {
    const map: Record<string, string> = {
      '/current-task': 'current-task',
      '/history': 'history',
      '/specialists': 'specialists',
      '/ai-teams': 'ai-teams',
      '/automations': 'automations',
      '/company-knowledge': 'company-knowledge',
      '/prompt-library': 'prompt-library',
      '/connections': 'connections',
      '/admin-dashboard': 'admin-dashboard',
      '/billing-api-keys': 'billing-api-keys',
    };
    return map[path] || defaultActiveNavId;
  }, [path]);

  const handleNav = (id: string) => {
    const routeMap: Record<string, string> = {
      'current-task': '/current-task',
      'history': '/history',
      'specialists': '/specialists',
      'ai-teams': '/ai-teams',
      'automations': '/automations',
      'company-knowledge': '/company-knowledge',
      'prompt-library': '/prompt-library',
      'connections': '/connections',
      'admin-dashboard': '/admin-dashboard',
      'billing-api-keys': '/billing-api-keys',
    };
    navigate(routeMap[id] || '/current-task');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">I</div>
        <div className="sidebar__brand-name">INT AI</div>
      </div>

      <button
        type="button"
        className="sidebar__new-task"
        onClick={() => navigate('/current-task')}
      >
        <span className="sidebar__new-task-icon" />
        <span>New task</span>
      </button>

      <nav className="sidebar__nav">
        {navGroups.map((group) => (
          <div className="sidebar__group" key={group.label}>
            <div className="sidebar__group-label">{group.label}</div>
            {group.items.map((item) => {
              const isActive = item.id === activeId;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`sidebar__item${isActive ? ' sidebar__item--active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => handleNav(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar__spacer" />

      <div className="sidebar__footer">
        <div className="sidebar__avatar">
          {authManager.getState().user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div>
          <div className="sidebar__org-name">{authManager.getState().user?.name || 'User'}</div>
          <div className="sidebar__org-plan">{authManager.getState().user?.email || ''}</div>
        </div>
        <button
          type="button"
          className="sidebar__logout"
          onClick={() => {
            authManager.logout();
            window.location.href = '/login';
          }}
          title="Sign out"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
