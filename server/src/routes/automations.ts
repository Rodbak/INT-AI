import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

const createAutomationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  triggerType: z.enum(['webhook', 'schedule', 'manual']),
  triggerConfig: z.any().optional(),
  steps: z.array(z.any()).optional(),
  workspaceId: z.string().min(1),
});

router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceIds = await prisma.workspaceUser.findMany({
      where: { userId: req.user!.id },
      select: { workspaceId: true },
    });

    const where: any = {
      workspaceId: { in: workspaceIds.map((w) => w.workspaceId) },
    };

    if (req.query.workspaceId) {
      where.workspaceId = req.query.workspaceId as string;
    }

    const automations = await prisma.automation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
        creator: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    res.json(automations);
  } catch (error) {
    throw error;
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const input = createAutomationSchema.parse(req.body);

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

    const automation = await prisma.automation.create({
      data: {
        name: input.name,
        description: input.description,
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig ?? {},
        steps: input.steps ?? [],
        workspaceId: input.workspaceId,
        createdBy: req.user!.id,
      },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
        creator: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    res.status(201).json(automation);
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
    const automation = await prisma.automation.findFirst({
      where: {
        id: req.params.id,
        workspace: { users: { some: { userId: req.user!.id } } },
      },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
        creator: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!automation) {
      res.status(404).json({ error: 'Automation not found' });
      return;
    }

    res.json(automation);
  } catch (error) {
    throw error;
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, triggerType, triggerConfig, steps, active } = req.body;

    const automation = await prisma.automation.updateMany({
      where: {
        id: req.params.id,
        workspace: { users: { some: { userId: req.user!.id } } },
      },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(triggerType !== undefined && { triggerType }),
        ...(triggerConfig !== undefined && { triggerConfig }),
        ...(steps !== undefined && { steps }),
        ...(active !== undefined && { active }),
      },
    });

    if (automation.count === 0) {
      res.status(404).json({ error: 'Automation not found' });
      return;
    }

    const updated = await prisma.automation.findUnique({
      where: { id: req.params.id },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
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
    const result = await prisma.automation.deleteMany({
      where: {
        id: req.params.id,
        workspace: { users: { some: { userId: req.user!.id } } },
      },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Automation not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    throw error;
  }
});

router.post('/:id/execute', async (req: AuthenticatedRequest, res) => {
  try {
    const automation = await prisma.automation.findFirst({
      where: {
        id: req.params.id,
        workspace: { users: { some: { userId: req.user!.id } } },
      },
      include: {
        workspace: true,
      },
    });

    if (!automation) {
      res.status(404).json({ error: 'Automation not found' });
      return;
    }

    if (!automation.active) {
      res.status(400).json({ error: 'Automation is not active' });
      return;
    }

    const jobId = `${automation.id}-${Date.now()}`;

    res.status(202).json({
      status: 'queued',
      automationId: req.params.id,
      jobId,
      message: 'Automation execution has been queued',
    });
  } catch (error) {
    throw error;
  }
});

export default router;
