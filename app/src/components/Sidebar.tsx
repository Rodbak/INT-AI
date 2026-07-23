import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authManager } from '../lib/auth';
import { navGroups, defaultActiveNavId, type NavGroup } from '../data/workspace';
import { BUILD_VERSION } from '../version';
import ThemeToggle from './ThemeToggle';
import './Sidebar.css';

// Single source of truth for id ⇄ route so the sidebar and the rest of the app
// stay in sync.
const ROUTES: Record<string, string> = {
  home: '/home',
  'current-task': '/current-task',
  sales: '/sales',
  customers: '/customers',
  stock: '/stock',
  money: '/money',
  reports: '/reports',
  pos: '/pos',
  'till-setup': '/till-setup',
  'company-knowledge': '/company-knowledge',
  history: '/history',
  settings: '/settings',
};

export default function Sidebar() {
  const navigate = useNavigate();
  const path = window.location.pathname;

  const activeId = useMemo(() => {
    const entry = Object.entries(ROUTES).find(([, route]) => route === path);
    return entry ? entry[0] : defaultActiveNavId;
  }, [path]);

  const handleNav = (id: string) => navigate(ROUTES[id] || '/home');

  const renderItems = (group: NavGroup) =>
    group.items.map((item) => {
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
    });

  const user = authManager.getState().user;

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__wordmark">INT<span className="sidebar__dot">.</span></div>
        <div className="sidebar__tagline">Your AI COO</div>
      </div>

      <nav className="sidebar__nav">
        {navGroups.map((group) => (
          <div className="sidebar__group" key={group.label}>
            <div className="sidebar__group-label">{group.label}</div>
            {renderItems(group)}
          </div>
        ))}
      </nav>

      <div className="sidebar__spacer" />

      <div className="sidebar__theme">
        <ThemeToggle />
      </div>

      <div className="sidebar__footer">
        <div className="sidebar__profile">
          <div className="sidebar__avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
          <div className="sidebar__profile-text">
            <div className="sidebar__org-name">{user?.name || 'User'}</div>
            <div className="sidebar__org-plan">{user?.email || ''}</div>
          </div>
        </div>
        <button
          type="button"
          className="sidebar__logout"
          onClick={() => {
            authManager.logout();
            window.location.href = '/login';
          }}
        >
          Sign out
        </button>
      </div>
      <div className="sidebar__version">build {BUILD_VERSION}</div>
    </aside>
  );
}
