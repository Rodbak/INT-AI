import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types.js';
import { verifyAccessToken } from '../auth.js';

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload || payload.type !== 'access') {
    res.status(401).json({ error: 'Invalid or expired access token' });
    return;
  }

  req.user = {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
  };

  next();
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    if (payload && payload.type === 'access') {
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    }
  }
  next();
}
