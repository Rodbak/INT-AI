import { Router, Response } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { prisma } from '../db.js';
import { env } from '../env.js';

const router = Router();

function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  });
}

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: any, res: Response) => {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      res.status(400).send('Missing Stripe signature');
      return;
    }

    let event: Stripe.Event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        env.STRIPE_WEBHOOK_SECRET || '',
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      res.status(400).send('Webhook signature verification failed');
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.userId;
          const planId = session.metadata?.planId;

          if (userId && planId && session.customer_email) {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (user) {
              await prisma.invoice.create({
                data: {
                  userId,
                  planId,
                  amount: 0,
                  status: 'paid',
                  periodStart: new Date(),
                  periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
              });
            }
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          // Find user by customer ID and downgrade to free plan
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          // Mark invoice as failed
          break;
        }
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Webhook handler error:', error);
      res.status(500).send('Webhook handler failed');
    }
  },
);

export default router;
