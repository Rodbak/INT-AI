import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import NeuralSpine from './NeuralSpine';
import { useParallax } from '../hooks/useParallax';
import './NeuralSpine.css';
import './Layout.css';

export default function Layout() {
  useParallax();
  return (
    <div className="layout">
      {/* Spatial-depth substrate: parallaxing glow strata + a faint holographic
          grid that sits far behind the content. */}
      <div className="layout__depth" aria-hidden="true">
        <span className="layout__glow layout__glow--1" />
        <span className="layout__glow layout__glow--2" />
        <span className="layout__grid" />
      </div>
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
