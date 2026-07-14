import { useState, useEffect, useCallback } from 'react';
import { authManager } from '../lib/auth';

export function useAuth() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'authenticated' | 'unauthenticated'>('idle');
  const [user, setUser] = useState(authManager.getState().user);

  useEffect(() => {
    const unsub = authManager.subscribe(() => {
      setStatus(authManager.getState().status);
      setUser(authManager.getState().user);
    });
    authManager.initialize();
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await authManager.login(email, password);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await authManager.logout();
  }, []);

  return { status, user, login, logout, isAuthenticated: status === 'authenticated' };
}
