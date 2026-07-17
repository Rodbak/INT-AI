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
  try {
    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalConversations,
      totalMessages,
      costAggregate,
      activeSpecialists,
      totalTeams,
      totalDocuments,
      totalConnections,
      recentUsage,
      modelGroups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.usageLog.aggregate({ _sum: { cost: true } }),
      prisma.specialist.count({ where: { active: true } }),
      prisma.team.count(),
      prisma.document.count(),
      prisma.connection.count(),
      prisma.usageLog.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, cost: true },
      }),
      prisma.usageLog.groupBy({
        by: ['model'],
        where: { model: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const activityByDay = new Map<string, number>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      activityByDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const log of recentUsage) {
      const day = log.createdAt.toISOString().slice(0, 10);
      activityByDay.set(day, (activityByDay.get(day) ?? 0) + log.cost);
    }

    res.json({
      totalUsers,
      totalConversations,
      totalMessages,
      totalCost: costAggregate._sum.cost ?? 0,
      activeSpecialists,
      totalTeams,
      totalDocuments,
      totalConnections,
      recentActivity: Array.from(activityByDay.entries()).map(([date, cost]) => ({ date, cost })),
      modelDistribution: modelGroups.map((g) => ({ model: g.model as string, count: g._count._all })),
    });
  } catch (error) {
    throw error;
  }
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
