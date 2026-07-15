import { Router, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

const updateUserSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  banned: z.boolean().optional(),
});

router.use(authenticate);
router.use(adminOnly);

router.get('/stats', async (req: AuthenticatedRequest, res) => {
  // ... existing stats code ...
});

router.get('/users', async (req: AuthenticatedRequest, res) => {
  try {
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page) : 1;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 20;
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const role = typeof req.query.role === 'string' ? req.query.role : '';

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              conversations: true,
              messages: true,
              usageLogs: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    throw error;
  }
});

router.patch('/users/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const input = updateUserSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(input.role !== undefined && { role: input.role }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    throw error;
  }
});

router.delete('/users/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.role === 'admin') {
      res.status(403).json({ error: 'Cannot delete admin users' });
      return;
    }

    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    throw error;
  }
});

export default router;
