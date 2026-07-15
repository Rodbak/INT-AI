import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest, UserRole } from '../types.js';
import { verifySupabaseToken } from '../auth.js';
import { prisma } from '../db.js';

async function loadUser(token: string): Promise<AuthenticatedRequest['user'] | null> {
  const payload = verifySupabaseToken(token);
  if (!payload) return null;

  const profile = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role as UserRole,
  };
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const user = await loadUser(authHeader.slice(7));
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired access token' });
    return;
  }

  req.user = user;
  next();
}

export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const user = await loadUser(authHeader.slice(7));
    if (user) {
      req.user = user;
    }
  }
  next();
}
