import { login, logout, getCurrentUser, refreshTokenRequest } from './api';
import type { User } from '../types';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
}

class AuthManager {
  private state: AuthState = {
    status: 'idle',
    user: null,
    error: null,
  };

  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState() {
    return this.state;
  }

  private setState(partial: Partial<AuthState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l());
  }

  async initialize() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      this.setState({ status: 'unauthenticated' });
      return;
    }
    this.setState({ status: 'loading' });
    try {
      const user = await getCurrentUser();
      this.setState({ status: 'authenticated', user, error: null });
    } catch {
      this.clearSession();
    }
  }

  async login(email: string, password: string) {
    this.setState({ status: 'loading', error: null });
    try {
      const data = await login(email, password);
      localStorage.setItem('auth_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      this.setState({ status: 'authenticated', user: data.user, error: null });
      return data.user;
    } catch (err: any) {
      const message = err?.error || 'Login failed';
      this.setState({ status: 'unauthenticated', error: message });
      throw new Error(message);
    }
  }

  async logout() {
    try {
      await logout();
    } catch {
      // ignore network errors
    }
    this.clearSession();
  }

  async refresh() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      this.clearSession();
      return;
    }
    try {
      const data = await refreshTokenRequest(refreshToken);
      localStorage.setItem('auth_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
    } catch {
      this.clearSession();
    }
  }

  private clearSession() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    this.setState({ status: 'unauthenticated', user: null, error: null });
  }
}

export const authManager = new AuthManager();
