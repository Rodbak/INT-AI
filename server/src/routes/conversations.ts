import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types';

const router = Router();

const createConversationSchema = z.object({
  title: z.string().min(1).max(200),
  provider: z.string().optional(),
  model: z.string().optional(),
});

router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        provider: true,
        model: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    res.json(conversations);
  } catch (error) {
    throw error;
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const input = createConversationSchema.parse(req.body);

    const conversation = await prisma.conversation.create({
      data: {
        userId: req.user!.id,
        title: input.title,
        provider: input.provider || null,
        model: input.model || null,
      },
    });

    res.status(201).json(conversation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    throw error;
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            provider: true,
            model: true,
            tokensIn: true,
            tokensOut: true,
            cost: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json(conversation);
  } catch (error) {
    throw error;
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { title, provider, model } = req.body;

    const conversation = await prisma.conversation.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data: {
        ...(title !== undefined && { title }),
        ...(provider !== undefined && { provider }),
        ...(model !== undefined && { model }),
      },
    });

    if (conversation.count === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const updated = await prisma.conversation.findUnique({
      where: { id: req.params.id },
    });

    res.json(updated);
  } catch (error) {
    throw error;
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await prisma.conversation.deleteMany({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    throw error;
  }
});

export default router;
