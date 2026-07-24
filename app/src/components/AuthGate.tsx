import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AUTH_ENABLED } from '../lib/auth';

/** Gates the app behind login when real auth is on. Transparent in demo mode. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (!AUTH_ENABLED) return <>{children}</>;
  if (status === 'idle' || status === 'loading') {
    return <div className="app-loading"><span className="app-loading__pulse">Loading…</span></div>;
  }
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  return <>{children}</>;
}
