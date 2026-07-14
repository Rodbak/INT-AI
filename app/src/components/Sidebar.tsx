import { useState } from 'react';
import { navGroups, defaultActiveNavId, workspaceOrg } from '../data/workspace';
import './Sidebar.css';

export default function Sidebar() {
  const [activeId, setActiveId] = useState(defaultActiveNavId);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">I</div>
        <div className="sidebar__brand-name">INT AI</div>
      </div>

      <button type="button" className="sidebar__new-task">
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
                  onClick={() => setActiveId(item.id)}
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
        <div className="sidebar__avatar">{workspaceOrg.initials}</div>
        <div>
          <div className="sidebar__org-name">{workspaceOrg.name}</div>
          <div className="sidebar__org-plan">{workspaceOrg.plan}</div>
        </div>
      </div>
    </aside>
  );
}
