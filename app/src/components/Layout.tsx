import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import './Layout.css';

export default function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      <div className="layout__main">
        <TopBar />
        <div className="layout__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
