import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest, UserRole } from '../types.js';
import { env } from '../env.js';
import { ensureDemoContext } from '../bootstrap.js';
import { authEnabled, verifyAccessToken } from '../auth/verify.js';
import { ensureUserContext } from '../auth/context.js';

// Shared-demo user, used only when AUTH_ENABLED is off. Must match a real row
// in profiles (see bootstrap.ts, which self-heals it).
const DEMO_USER = {
  id: env.DEMO_USER_ID,
  email: env.DEMO_USER_EMAIL,
  role: 'admin' as UserRole,
};

/** Require a signed-in user (real auth) or fall back to the demo user. */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (authEnabled()) {
    const user = verifyAccessToken(req);
    if (!user) { res.status(401).json({ error: 'Sign in to continue' }); return; }
    req.user = user;
    await ensureUserContext(user.id, user.email, user.name, user.shopName).catch(() => {});
    next();
    return;
  }
  // Demo mode: attach the shared demo user (self-healing its profile/workspace).
  req.user = DEMO_USER;
  await ensureDemoContext().catch(() => {});
  next();
}

/** Attach a user when possible, but never block the request. */
export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (authEnabled()) {
    const user = verifyAccessToken(req);
    if (user) {
      req.user = user;
      await ensureUserContext(user.id, user.email, user.name, user.shopName).catch(() => {});
    }
    // No token → leave unauthenticated; downstream resolves to no workspace.
    next();
    return;
  }
  req.user = DEMO_USER;
  await ensureDemoContext().catch(() => {});
  next();
}

export async function adminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
