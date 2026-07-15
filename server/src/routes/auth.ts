import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  createSession,
  refreshSession,
  revokeAllSessions,
  generateId,
} from '../auth.js';
import type { LoginRequest, RegisterRequest, AuthTokens, AuthenticatedRequest, UserRole } from '../types.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', async (req, res) => {
  try {
    const input = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        id: generateId(),
        email: input.email,
        passwordHash,
        name: input.name || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    const { sessionId, refreshToken } = await createSession(user.id);
    const accessToken = signAccessToken({ ...user, role: user.role as UserRole });

    res.status(201).json({
      user,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
        sessionId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    throw error;
  }
});

router.post('/login', async (req, res) => {
  try {
    const input = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const { sessionId, refreshToken } = await createSession(user.id);
    const accessToken = signAccessToken({ ...user, role: user.role as UserRole });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
        sessionId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    throw error;
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }

    const tokens = await refreshSession(refreshToken);
    if (!tokens) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    res.json(tokens);
  } catch (error) {
    throw error;
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    if (refreshToken) {
      await revokeAllSessions(req.user!.id);
    }
    res.json({ success: true });
  } catch (error) {
    throw error;
  }
});

router.get('/me', (req: AuthenticatedRequest, res) => {
  res.json({
    user: {
      id: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
    },
  });
});

export default router;
