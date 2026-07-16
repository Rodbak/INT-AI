import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest, UserRole } from '../types.js';
import { env } from '../env.js';

// Real per-request auth is disabled — every request is attached to this one
// user. It must match a real row in Supabase's auth.users (profiles has a
// foreign key to it), so its id is configurable via DEMO_USER_ID rather than
// hardcoded — see DEPLOYMENT.md for how to create that user and set this.
const DEMO_USER = {
  id: env.DEMO_USER_ID,
  email: env.DEMO_USER_EMAIL,
  role: 'admin' as UserRole,
};

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  // Auth is disabled - attach demo user
  req.user = DEMO_USER;
  next();
}

export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  // Auth is disabled - attach demo user
  req.user = DEMO_USER;
  next();
}

export async function adminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
