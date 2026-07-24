import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { User } from '../types/index';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
}

// Real per-user auth is on only when this build-time flag is set. Otherwise the
// app runs in shared-demo mode (one shop, no login) exactly as before.
export const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';

const DEMO_USER: User = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'demo@example.com',
  name: 'Demo User',
  role: 'admin',
};

// Ghana phone → E.164 (+233…) so Supabase phone auth accepts it.
export function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('233')) return `+${d}`;
  if (d.startsWith('0')) return `+233${d.slice(1)}`;
  if (raw.trim().startsWith('+')) return `+${d}`;
  return `+233${d}`;
}

export function isEmail(id: string): boolean {
  return id.includes('@');
}

class AuthManager {
  private state: AuthState = AUTH_ENABLED
    ? { status: 'loading', user: null, error: null }
    : { status: 'authenticated', user: DEMO_USER, error: null };
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return (): void => { this.listeners.delete(listener); };
  }

  getState() { return this.state; }

  private setState(partial: Partial<AuthState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l());
  }

  private applySession(session: Session | null) {
    const u = session?.user;
    if (u) {
      this.setState({
        status: 'authenticated',
        user: {
          id: u.id,
          email: u.email || u.phone || '',
          name: (u.user_metadata?.name as string) || u.email?.split('@')[0] || 'Owner',
          role: 'user',
        },
        error: null,
      });
    } else {
      this.setState({ status: 'unauthenticated', user: null, error: null });
    }
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    if (!AUTH_ENABLED) {
      this.setState({ status: 'authenticated', user: DEMO_USER, error: null });
      return;
    }
    try {
      const { data } = await supabase.auth.getSession();
      this.applySession(data.session);
    } catch {
      this.setState({ status: 'unauthenticated', user: null });
    }
    supabase.auth.onAuthStateChange((_event, session) => this.applySession(session));
  }

  async signInWithPassword(identifier: string, password: string) {
    const creds = isEmail(identifier) ? { email: identifier.trim() } : { phone: normalizePhone(identifier) };
    const { error } = await supabase.auth.signInWithPassword({ ...creds, password } as any);
    if (error) throw new Error(error.message);
  }

  // Sign up an owner and stash their name + shop name in user_metadata so the
  // backend can name their shop and greet them on first load.
  async signUpWithPassword(input: { identifier: string; password: string; name: string; shopName: string }) {
    const { identifier, password, name, shopName } = input;
    const creds = isEmail(identifier) ? { email: identifier.trim() } : { phone: normalizePhone(identifier) };
    const { error } = await supabase.auth.signUp({
      ...creds,
      password,
      options: { data: { name, shop_name: shopName } },
    } as any);
    if (error) throw new Error(error.message);
  }

  async resetPassword(identifier: string) {
    if (!isEmail(identifier)) throw new Error('Enter your email to reset your password.');
    const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim(), { redirectTo: `${window.location.origin}/login` });
    if (error) throw new Error(error.message);
  }

  async signInWithGoogle() {
    if (!AUTH_ENABLED) return;
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/home` } });
    if (error) throw new Error(error.message);
  }

  async logout() {
    if (AUTH_ENABLED) { await supabase.auth.signOut().catch(() => {}); }
    this.setState({ status: 'unauthenticated', user: null, error: null });
  }
}

export const authManager = new AuthManager();
