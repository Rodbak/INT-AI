import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest, UserRole } from '../types.js';

// Demo user for public access
const DEMO_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'demo@example.com',
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
