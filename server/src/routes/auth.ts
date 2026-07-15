import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

router.get('/me', authenticate, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

export default router;
