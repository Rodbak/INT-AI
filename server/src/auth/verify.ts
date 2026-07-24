import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { env } from '../env.js';
import type { UserRole } from '../types.js';

export interface VerifiedUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  shopName?: string;
}

/** Whether real per-user auth is switched on. */
export function authEnabled(): boolean {
  const v = (env.AUTH_ENABLED || '').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * Verify the Supabase access token on the request (Authorization: Bearer …).
 * Supabase signs access tokens with the project's JWT secret (HS256); the
 * payload's `sub` is the user id. Returns null if there's no valid token.
 */
export function verifyAccessToken(req: Request): VerifiedUser | null {
  const header = req.header('authorization') || req.header('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET) as jwt.JwtPayload;
    const id = String(payload.sub || '');
    if (!id) return null;
    const email = String(payload.email || payload.phone || `${id}@user.int`);
    const meta = (payload.user_metadata as Record<string, unknown> | undefined) || {};
    // App-level role: our profiles.role, not Supabase's "authenticated" aud role.
    return {
      id,
      email,
      role: 'user' as UserRole,
      name: typeof meta.name === 'string' ? meta.name : undefined,
      shopName: typeof meta.shop_name === 'string' ? meta.shop_name : undefined,
    };
  } catch {
    return null;
  }
}
