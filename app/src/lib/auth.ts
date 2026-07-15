import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { User } from '../types/index';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
}

const DEMO_USER: User = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'demo@example.com',
  name: 'Demo User',
  role: 'admin',
};

class AuthManager {
  private state: AuthState = { status: 'authenticated', user: DEMO_USER, error: null };
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  getState() {
    return this.state;
  }

  private setState(partial: Partial<AuthState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l());
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    // Auth is disabled - always return demo user
    this.setState({ status: 'authenticated', user: DEMO_USER, error: null });
  }

  async signInWithGoogle() {
    // Auth is disabled - no-op
  }

  async logout() {
    // Auth is disabled - no-op
  }
}

export const authManager = new AuthManager();
