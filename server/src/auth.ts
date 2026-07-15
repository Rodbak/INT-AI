import jwt from 'jsonwebtoken';
import { env } from './env.js';

export interface SupabaseJWTPayload {
  sub: string;
  email: string;
  role: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  exp: number;
}

export function verifySupabaseToken(token: string): SupabaseJWTPayload | null {
  try {
    return jwt.verify(token, env.SUPABASE_JWT_SECRET) as SupabaseJWTPayload;
  } catch {
    return null;
  }
}
