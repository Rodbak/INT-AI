import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

const createTeamSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  workspaceId: z.string(),
  members: z.array(z.object({
    specialistId: z.string(),
    order: z.number().optional(),
  })).optional(),
});

router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceIds = await prisma.workspaceUser.findMany({
      where: { userId: req.user!.id },
      select: { workspaceId: true },
    });

    const teams = await prisma.team.findMany({
      where: { workspaceId: { in: workspaceIds.map(w => w.workspaceId) } },
      orderBy: { createdAt: 'desc' },
      include: {
        workspace: true,
        creator: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        members: {
          include: {
            specialist: true,
          },
        },
      },
    });

    res.json(teams);
  } catch (error) {
    throw error;
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const input = createTeamSchema.parse(req.body);

    const team = await prisma.$transaction(async (tx) => {
      return await tx.team.create({
        data: {
          name: input.name,
          description: input.description || null,
          workspaceId: input.workspaceId,
          createdBy: req.user!.id,
          members: input.members ? {
            create: input.members.map(member => ({
              specialistId: member.specialistId,
              order: member.order ?? 0,
            })),
          } : undefined,
        },
        include: {
          workspace: true,
          creator: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          members: {
            include: {
              specialist: true,
            },
          },
        },
      });
    });

    res.status(201).json(team);
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
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: {
        workspace: true,
        creator: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        members: {
          include: {
            specialist: true,
          },
        },
      },
    });

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    res.json(team);
  } catch (error) {
    throw error;
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, members } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      const team = await tx.team.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
        },
        include: {
          workspace: true,
          creator: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          members: {
            include: {
              specialist: true,
            },
          },
        },
      });

      if (members !== undefined) {
        await tx.teamMember.deleteMany({
          where: { teamId: req.params.id },
        });

        await tx.teamMember.createMany({
          data: members.map((member: { specialistId: string; order?: number }) => ({
            specialistId: member.specialistId,
            order: member.order ?? 0,
          })),
        });

        const refreshed = await tx.team.findUnique({
          where: { id: req.params.id },
          include: {
            workspace: true,
            creator: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
            members: {
              include: {
                specialist: true,
              },
            },
          },
        });

        return refreshed;
      }

      return team;
    });

    res.json(updated);
  } catch (error) {
    throw error;
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await prisma.team.deleteMany({
      where: { id: req.params.id },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    throw error;
  }
});

export default router;
