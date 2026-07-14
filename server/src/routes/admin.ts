import { Router, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types';

const router = Router();

export function adminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

router.use(authenticate);
router.use(adminOnly);

router.get('/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalUsers,
      totalConversations,
      totalMessages,
      totalUsageCost,
      activeSpecialists,
      totalTeams,
      totalDocuments,
      totalConnections,
      modelDistribution,
      recentLogs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.usageLog.aggregate({ _sum: { cost: true } }),
      prisma.specialist.count({ where: { active: true } }),
      prisma.team.count(),
      prisma.document.count(),
      prisma.connection.count(),
      prisma.message.groupBy({ by: ['model'], _count: { _all: true } }),
      prisma.usageLog.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true, cost: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const recentActivity = recentLogs.reduce<Record<string, number>>((acc, log) => {
      const day = log.createdAt.toISOString().slice(0, 10);
      acc[day] = (acc[day] ?? 0) + (log.cost ?? 0);
      return acc;
    }, {});

    res.json({
      totalUsers,
      totalConversations,
      totalMessages,
      totalCost: totalUsageCost._sum.cost ?? 0,
      activeSpecialists,
      totalTeams,
      totalDocuments,
      totalConnections,
      recentActivity,
      modelDistribution: modelDistribution.map((m) => ({
        model: m.model,
        count: m._count._all,
      })),
    });
  } catch (error) {
    throw error;
  }
});

export default router;
