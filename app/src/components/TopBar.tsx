import { useLocation } from 'react-router-dom';
import './TopBar.css';

const PAGE_TITLES: Record<string, string> = {
  '/current-task': 'Current task',
  '/history': 'History',
  '/specialists': 'Specialists',
  '/ai-teams': 'AI Teams',
  '/automations': 'Automations',
  '/company-knowledge': 'Company Knowledge',
  '/prompt-library': 'Prompt Library',
  '/connections': 'Connections',
  '/admin-dashboard': 'Admin Dashboard',
  '/billing-api-keys': 'Billing & API Keys',
  '/settings': 'Settings',
};

export default function TopBar() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'INT AI';

  return (
    <header className="topbar">
      <div className="topbar__task">
        <div className="topbar__title">{title}</div>
        <div className="topbar__team">&nbsp;·&nbsp; Workspace</div>
      </div>
      <div className="topbar__status">
        <span className="topbar__status-dot" />
        <span className="topbar__status-label">Routing engine active</span>
      </div>
    </header>
  );
}
