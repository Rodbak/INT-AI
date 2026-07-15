import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  plan: z.enum(['FREE', 'PRO', 'ENTERPRISE']).default('FREE'),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  plan: z.enum(['FREE', 'PRO', 'ENTERPRISE']).optional(),
});

router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: {
        users: { some: { userId: req.user!.id } },
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(workspaces);
  } catch (error) {
    throw error;
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const input = createWorkspaceSchema.parse(req.body);

    const existing = await prisma.workspace.findUnique({
      where: { slug: input.slug },
    });

    if (existing) {
      res.status(409).json({ error: 'Workspace slug already exists' });
      return;
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: input.name,
        slug: input.slug,
        plan: input.plan,
        users: {
          create: {
            userId: req.user!.id,
            role: 'OWNER',
          },
        },
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(workspace);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    throw error;
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const input = updateWorkspaceSchema.parse(req.body);

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: req.params.id,
        users: { some: { userId: req.user!.id, role: 'OWNER' } },
      },
    });

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found or insufficient permissions' });
      return;
    }

    const updated = await prisma.workspace.update({
      where: { id: req.params.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.plan !== undefined && { plan: input.plan }),
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
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

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: req.params.id,
        users: { some: { userId: req.user!.id, role: 'OWNER' } },
      },
    });

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found or insufficient permissions' });
      return;
    }

    await prisma.workspace.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    throw error;
  }
});

router.post('/:id/members', async (req: AuthenticatedRequest, res) => {
  try {
    const inviteSchema = z.object({
      email: z.string().email(),
      role: z.enum(['MEMBER', 'ADMIN']).default('MEMBER'),
    });

    const input = inviteSchema.parse(req.body);

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: req.params.id,
        users: { some: { userId: req.user!.id, role: { in: ['OWNER', 'ADMIN'] } } },
      },
    });

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found or insufficient permissions' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found. They must sign up first.' });
      return;
    }

    const membership = await prisma.workspaceUser.upsert({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: req.params.id,
        },
      },
      update: {
        role: input.role,
      },
      create: {
        userId: user.id,
        workspaceId: req.params.id,
        role: input.role,
      },
    });

    res.status(201).json(membership);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    throw error;
  }
});

router.delete('/:id/members/:userId', async (req: AuthenticatedRequest, res) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: req.params.id,
        users: { some: { userId: req.user!.id, role: 'OWNER' } },
      },
    });

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found or insufficient permissions' });
      return;
    }

    const result = await prisma.workspaceUser.deleteMany({
      where: {
        userId: req.params.userId,
        workspaceId: req.params.id,
        role: { not: 'OWNER' },
      },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Member not found or cannot remove owner' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    throw error;
  }
});

export default router;
