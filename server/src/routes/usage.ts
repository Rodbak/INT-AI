import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types';

const router = Router();

function buildDateWhere(query: Record<string, unknown>) {
  const where: any = {};
  const dateFilter: any = {};
  if (typeof query.from === 'string' && query.from) {
    dateFilter.gte = new Date(query.from);
  }
  if (typeof query.to === 'string' && query.to) {
    dateFilter.lte = new Date(query.to);
  }
  if (Object.keys(dateFilter).length > 0) {
    where.createdAt = dateFilter;
  }
  return where;
}

router.use(authenticate);

router.get('/summary', async (req: AuthenticatedRequest, res) => {
  try {
    const where: any = { userId: req.user!.id, ...buildDateWhere(req.query) };

    const [aggregate, conversations] = await Promise.all([
      prisma.usageLog.aggregate({
        where,
        _sum: { tokensIn: true, tokensOut: true, cost: true },
      }),
      prisma.usageLog.findMany({
        where,
        distinct: ['conversationId'],
        select: { conversationId: true },
      }),
    ]);

    res.json({
      totalTokensIn: aggregate._sum.tokensIn ?? 0,
      totalTokensOut: aggregate._sum.tokensOut ?? 0,
      totalCost: aggregate._sum.cost ?? 0,
      conversationCount: conversations.length,
      period: {
        from: typeof req.query.from === 'string' ? req.query.from : null,
        to: typeof req.query.to === 'string' ? req.query.to : null,
      },
    });
  } catch (error) {
    throw error;
  }
});

router.get('/breakdown', async (req: AuthenticatedRequest, res) => {
  try {
    const where: any = { userId: req.user!.id, ...buildDateWhere(req.query) };

    const grouped = await prisma.usageLog.groupBy({
      by: ['model'],
      where,
      _sum: { tokensIn: true, tokensOut: true, cost: true },
      _count: { _all: true },
    });

    const breakdown = grouped.map((g) => ({
      model: g.model,
      tokensIn: g._sum.tokensIn ?? 0,
      tokensOut: g._sum.tokensOut ?? 0,
      cost: g._sum.cost ?? 0,
      count: g._count._all,
    }));

    res.json(breakdown);
  } catch (error) {
    throw error;
  }
});

export default router;
