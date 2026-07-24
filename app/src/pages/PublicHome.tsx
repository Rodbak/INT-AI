import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AUTH_ENABLED } from '../lib/auth';
import LandingPage from './LandingPage';

/**
 * The public root ("/"). In demo mode there's no landing page — go straight to
 * the app. With auth on: signed-in owners are sent to their dashboard, everyone
 * else sees the marketing landing page.
 */
export default function PublicHome() {
  const { status } = useAuth();
  if (!AUTH_ENABLED) return <Navigate to="/home" replace />;
  if (status === 'idle' || status === 'loading') {
    return <div className="app-loading"><span className="app-loading__pulse">Loading…</span></div>;
  }
  if (status === 'authenticated') return <Navigate to="/home" replace />;
  return <LandingPage />;
}
