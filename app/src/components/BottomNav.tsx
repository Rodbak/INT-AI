import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authManager } from '../lib/auth';
import ThemeToggle from './ThemeToggle';
import './BottomNav.css';

// Plain, finger-sized icons (stroke-based, inherit currentColor).
const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  ask: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  sales: 'M3 3v18h18M7 14l3-4 4 3 5-7',
  money: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  more: 'M4 6h16M4 12h16M4 18h16',
};

const TABS = [
  { id: 'home', label: 'Home', route: '/home', icon: ICONS.home },
  { id: 'sales', label: 'Sales', route: '/sales', icon: ICONS.sales },
  { id: 'ask', label: 'Ask INT', route: '/current-task', icon: ICONS.ask },
  { id: 'money', label: 'Money', route: '/money', icon: ICONS.money },
];

// Everything reachable from the "More" drawer.
const MORE_LINKS = [
  { label: 'Open Till', route: '/pos' },
  { label: 'Customers', route: '/customers' },
  { label: 'Stock', route: '/stock' },
  { label: 'Reports', route: '/reports' },
  { label: 'Till setup', route: '/till-setup' },
  { label: 'Company Knowledge', route: '/company-knowledge' },
  { label: 'History', route: '/history' },
  { label: 'Settings', route: '/settings' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const go = (route: string) => { setMoreOpen(false); navigate(route); };
  const user = authManager.getState().user;

  const moreActive = MORE_LINKS.some((l) => l.route === pathname);

  return (
    <>
      <nav className="bottomnav" aria-label="Main">
        {TABS.map((t) => {
          const active = pathname === t.route;
          return (
            <button key={t.id} className={`bottomnav__tab${active ? ' bottomnav__tab--active' : ''}`} onClick={() => go(t.route)}>
              <Icon d={t.icon} />
              <span>{t.label}</span>
            </button>
          );
        })}
        <button className={`bottomnav__tab${moreOpen || moreActive ? ' bottomnav__tab--active' : ''}`} onClick={() => setMoreOpen(true)}>
          <Icon d={ICONS.more} />
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="bottomnav__overlay" onClick={() => setMoreOpen(false)}>
          <div className="bottomnav__drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="More menu">
            <div className="bottomnav__handle" />
            <div className="bottomnav__profile">
              <div className="bottomnav__avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
              <div className="bottomnav__profile-text">
                <div className="bottomnav__name">{user?.name || 'User'}</div>
                <div className="bottomnav__email">{user?.email || ''}</div>
              </div>
            </div>

            <div className="bottomnav__links">
              {MORE_LINKS.map((l) => (
                <button key={l.route} className="bottomnav__link" onClick={() => go(l.route)}>{l.label}</button>
              ))}
            </div>

            <div className="bottomnav__drawer-footer">
              <ThemeToggle />
              <button
                className="bottomnav__logout"
                onClick={() => { authManager.logout(); window.location.href = '/login'; }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
