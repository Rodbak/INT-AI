import { Router } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { env } from '../env.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }
  return stripeClient;
}

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

    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID_MAP) {
      res.status(503).json({ error: 'Payments are not configured' });
      return;
    }

    let priceIdMap: Record<string, string>;
    try {
      priceIdMap = JSON.parse(env.STRIPE_PRICE_ID_MAP) as Record<string, string>;
    } catch {
      res.status(500).json({ error: 'STRIPE_PRICE_ID_MAP is not valid JSON' });
      return;
    }

    const priceId = priceIdMap[plan.id];
    if (!priceId) {
      res.status(400).json({ error: `No Stripe price configured for plan ${plan.id}` });
      return;
    }

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: req.user?.email,
      metadata: {
        userId: req.user!.id,
        planId: plan.id,
      },
      success_url: `${env.PUBLIC_BASE_URL || 'http://localhost:5173'}/billing-api-keys?success=true`,
      cancel_url: `${env.PUBLIC_BASE_URL || 'http://localhost:5173'}/billing-api-keys?canceled=true`,
    });

    res.json({ checkoutUrl: session.url, status: 'pending' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    throw error;
  }
});

export default router;
