import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

const createConnectionSchema = z.object({
  provider: z.enum(['google', 'microsoft', 'slack', 'github']),
  name: z.string().min(1),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().optional(),
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

    const connections = await prisma.connection.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        expiresAt: true,
        workspaceId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    res.json(connections);
  } catch (error) {
    throw error;
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const input = createConnectionSchema.parse(req.body);

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

    const connection = await prisma.connection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: input.workspaceId,
          provider: input.provider,
        },
      },
      update: {
        name: input.name,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
      create: {
        provider: input.provider,
        name: input.name,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        workspaceId: input.workspaceId,
        userId: req.user!.id,
      },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        expiresAt: true,
        workspaceId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    res.status(201).json(connection);
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
    const connection = await prisma.connection.findFirst({
      where: {
        id: req.params.id,
        workspace: { users: { some: { userId: req.user!.id } } },
      },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        expiresAt: true,
        workspaceId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    res.json(connection);
  } catch (error) {
    throw error;
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await prisma.connection.deleteMany({
      where: {
        id: req.params.id,
        workspace: { users: { some: { userId: req.user!.id } } },
      },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    throw error;
  }
});

export default router;
