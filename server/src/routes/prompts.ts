import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

const createPromptSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  workspaceId: z.string().min(1),
});

router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceIds = await prisma.workspaceUser.findMany({
      where: { userId: req.user!.id },
      select: { workspaceId: true },
    });

    const where = workspaceIds.length > 0
      ? { workspaceId: { in: workspaceIds.map((w) => w.workspaceId) } }
      : {};

    if (req.query.workspaceId) {
      (where as any).workspaceId = req.query.workspaceId as string;
    }

    const prompts = await prisma.prompt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    res.json(prompts);
  } catch (error) {
    throw error;
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const input = createPromptSchema.parse(req.body);

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: input.workspaceId,
        users: { some: { userId: req.user!.id } },
      },
    });

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    const prompt = await prisma.prompt.create({
      data: {
        title: input.title,
        content: input.content,
        tags: input.tags ?? [],
        workspaceId: input.workspaceId,
        createdBy: req.user!.id,
      },
      include: {
        creator: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    res.status(201).json(prompt);
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
    const prompt = await prisma.prompt.findFirst({
      where: {
        id: req.params.id,
        workspace: { users: { some: { userId: req.user!.id } } },
      },
      include: {
        creator: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!prompt) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    res.json(prompt);
  } catch (error) {
    throw error;
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { title, content, tags } = req.body;

    const prompt = await prisma.prompt.updateMany({
      where: {
        id: req.params.id,
        workspace: { users: { some: { userId: req.user!.id } } },
      },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(tags !== undefined && { tags }),
      },
    });

    if (prompt.count === 0) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    const updated = await prisma.prompt.findUnique({
      where: { id: req.params.id },
      include: {
        creator: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    throw error;
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await prisma.prompt.deleteMany({
      where: {
        id: req.params.id,
        workspace: { users: { some: { userId: req.user!.id } } },
      },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    throw error;
  }
});

export default router;
