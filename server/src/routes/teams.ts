import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { RoutingEngine } from '../routing/engine.js';
import { buildSpecialistPrompt, resolveModelForProviders } from '../routing/specialist.js';
import { buildPlatformIdentity, availableProviders, loadPlatformRoster } from '../routing/platform.js';
import { createSSEResponse, sendSSEEnd } from '../utils/stream.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();
const teamEngine = new RoutingEngine();

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

// Orchestrate a team: pipeline the request through each specialist in order,
// each one building on the accumulated work of the ones before it. Streams
// per-stage SSE events so the client can show the signal firing through the
// team, member by member.
const runSchema = z.object({
  message: z.string().min(1),
});

router.post('/:id/run', async (req: AuthenticatedRequest, res) => {
  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'A message is required' });
    return;
  }
  const { message } = parsed.data;

  const team = await prisma.team.findFirst({
    where: { id: req.params.id },
    include: {
      members: {
        orderBy: { order: 'asc' },
        include: { specialist: true },
      },
    },
  });

  if (!team) {
    res.status(404).json({ error: 'Team not found' });
    return;
  }

  const members = team.members.filter((m) => m.specialist && m.specialist.active);
  createSSEResponse(res);

  const write = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  write({
    type: 'team',
    team: { id: team.id, name: team.name },
    stages: members.map((m) => ({
      specialist: { id: m.specialist.id, name: m.specialist.name, role: m.specialist.role },
    })),
  });

  if (members.length === 0) {
    write({ type: 'error', error: 'This team has no active specialists.' });
    sendSSEEnd(res);
    return;
  }

  // Ground every team member in INT AI's self-knowledge, so each one knows it
  // is a specialist inside this platform, running as one stage of this team.
  const roster = await loadPlatformRoster();
  const providers = availableProviders();

  let combined = '';

  try {
    for (let i = 0; i < members.length; i++) {
      const s = members[i].specialist;
      write({ type: 'stage', index: i, status: 'start', specialist: { id: s.id, name: s.name, role: s.role } });

      const first = i === 0;
      const userMessage = first
        ? message
        : `The user's request:\n${message}\n\nWork produced so far by the team:\n${combined}\n\nAs ${s.name} (${s.role}), build on the prior work and contribute your part. Do not repeat earlier sections verbatim.`;

      // Re-route the member's pinned model through OpenRouter if its native
      // provider has no key, so the team still runs on an OpenRouter-only setup.
      const resolved = s.model ? resolveModelForProviders(s.model, providers) : undefined;
      const preferredModel = resolved?.model;
      const preferredProvider = resolved?.provider;

      const platformIdentity = buildPlatformIdentity({
        availableProviders: providers,
        specialists: roster.specialists,
        teams: roster.teams,
        activeSpecialist: { name: s.name, role: s.role },
        activeTeam: { name: team.name, position: i + 1, total: members.length },
      });

      const { chunks } = await teamEngine.execute({
        message: userMessage,
        history: [],
        userId: req.user?.id,
        systemPrompt: `${platformIdentity}\n\n${buildSpecialistPrompt(s)}`,
        preferredProvider,
        preferredModel,
      });

      let stageText = '';
      let stageError: string | undefined;
      for await (const chunk of chunks) {
        if (chunk.type === 'text') {
          stageText += chunk.content || '';
          write({ type: 'text', index: i, content: chunk.content });
        } else if (chunk.type === 'error') {
          stageError = chunk.error;
          break;
        }
      }

      if (stageError) {
        write({ type: 'stage', index: i, status: 'error', error: stageError });
        write({ type: 'error', error: `${s.name} failed: ${stageError}` });
        sendSSEEnd(res);
        return;
      }

      combined += `\n\n## ${s.name} — ${s.role}\n${stageText}`;
      write({ type: 'stage', index: i, status: 'done' });
    }

    write({ type: 'done' });
    sendSSEEnd(res);
  } catch (error: unknown) {
    write({ type: 'error', error: error instanceof Error ? error.message : 'Team run failed' });
    sendSSEEnd(res);
  }
});

export default router;
