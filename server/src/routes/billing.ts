import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types';

const router = Router();

const checkoutSchema = z.object({
  planId: z.string().min(1),
});

router.use(authenticate);

router.get('/plans', async (req: AuthenticatedRequest, res) => {
  try {
    const plans = await prisma.billingPlan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });

    res.json(plans);
  } catch (error) {
    throw error;
  }
});

router.get('/invoices', async (req: AuthenticatedRequest, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { userId: req.user!.id },
      include: {
        plan: { select: { id: true, name: true, price: true, interval: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invoices);
  } catch (error) {
    throw error;
  }
});

router.post('/checkout', async (req: AuthenticatedRequest, res) => {
  try {
    const input = checkoutSchema.parse(req.body);

    const plan = await prisma.billingPlan.findFirst({
      where: { id: input.planId, active: true },
    });

    if (!plan) {
      res.status(404).json({ error: 'Plan not found or inactive' });
      return;
    }

    res.json({
      checkoutUrl: `https://checkout.example.com/session/${plan.id}-${req.user!.id}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    throw error;
  }
});

export default router;
