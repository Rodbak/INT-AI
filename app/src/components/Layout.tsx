import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import InstallPrompt from './InstallPrompt';
import './Layout.css';

export default function Layout() {
  // Key the content on the path so each tab switch re-mounts and plays a quick
  // fade-in — the app reads as one fluid surface instead of hard page cuts.
  const { pathname } = useLocation();
  return (
    <div className="layout">
      <Sidebar />
      <div className="layout__main">
        <TopBar />
        <div className="layout__content">
          <div key={pathname} className="route-anim">
            <Outlet />
          </div>
        </div>
      </div>
      <BottomNav />
      <InstallPrompt />
    </div>
  );
}
