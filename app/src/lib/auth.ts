import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { getCurrentUser } from './api';
import type { User } from '../types/index';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
}

function fallbackUser(supabaseUser: SupabaseUser): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    name:
      (supabaseUser.user_metadata?.full_name as string) ||
      (supabaseUser.user_metadata?.name as string) ||
      supabaseUser.email ||
      '',
    role: 'member',
  };
}

class AuthManager {
  private state: AuthState = { status: 'idle', user: null, error: null };
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

  private async resolveUser(supabaseUser: SupabaseUser): Promise<User> {
    try {
      return await getCurrentUser();
    } catch {
      return fallbackUser(supabaseUser);
    }
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.setState({ status: 'loading' });

    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const user = await this.resolveUser(data.session.user);
      this.setState({ status: 'authenticated', user, error: null });
    } else {
      this.setState({ status: 'unauthenticated' });
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const user = await this.resolveUser(session.user);
        this.setState({ status: 'authenticated', user, error: null });
      } else {
        this.setState({ status: 'unauthenticated', user: null });
      }
    });
  }

  async signInWithGoogle() {
    this.setState({ status: 'loading', error: null });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/current-task` },
    });
    if (error) {
      this.setState({ status: 'unauthenticated', error: error.message });
      throw error;
    }
  }

  async logout() {
    await supabase.auth.signOut();
    this.setState({ status: 'unauthenticated', user: null, error: null });
  }
}

export const authManager = new AuthManager();
