import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import NeuralSpine from './NeuralSpine';
import './NeuralSpine.css';
import './Layout.css';

export default function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      {/* The nervous system lives in its own column between the nav and the
          workspace — never behind text. */}
      <NeuralSpine />
      <div className="layout__main">
        <TopBar />
        <div className="layout__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
