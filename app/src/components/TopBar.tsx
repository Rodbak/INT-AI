import { currentTask } from '../data/workspace';
import './TopBar.css';

export default function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar__task">
        <div className="topbar__title">{currentTask.title}</div>
        <div className="topbar__team">&nbsp;·&nbsp; {currentTask.team}</div>
      </div>
      <div className="topbar__status">
        <span className="topbar__status-dot" />
        <span className="topbar__status-label">Routing engine active</span>
      </div>
    </header>
  );
}
