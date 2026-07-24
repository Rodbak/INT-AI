import { useState, useEffect, useCallback } from 'react';
import { authManager } from '../lib/auth';

export function useAuth() {
  const [status, setStatus] = useState(authManager.getState().status);
  const [user, setUser] = useState(authManager.getState().user);

  useEffect(() => {
    const unsub = authManager.subscribe(() => {
      setStatus(authManager.getState().status);
      setUser(authManager.getState().user);
    });
    authManager.initialize();
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => { await authManager.signInWithGoogle(); }, []);
  const signInWithPassword = useCallback(async (id: string, pw: string) => { await authManager.signInWithPassword(id, pw); }, []);
  const signUpWithPassword = useCallback(
    async (input: { identifier: string; password: string; name: string; shopName: string }) => { await authManager.signUpWithPassword(input); },
    [],
  );
  const resetPassword = useCallback(async (id: string) => { await authManager.resetPassword(id); }, []);
  const logout = useCallback(async () => { await authManager.logout(); }, []);

  return {
    status,
    user,
    signInWithGoogle,
    signInWithPassword,
    signUpWithPassword,
    resetPassword,
    logout,
    isAuthenticated: status === 'authenticated',
  };
}
