import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types';

const router = Router();

const createSpecialistSchema = z.object({
  name: z.string(),
  role: z.string(),
  description: z.string().optional(),
  model: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const specialists = await prisma.specialist.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        role: true,
        description: true,
        model: true,
        capabilities: true,
        active: true,
        createdAt: true,
      },
    });

    res.json(specialists);
  } catch (error) {
    throw error;
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const input = createSpecialistSchema.parse(req.body);

    const specialist = await prisma.specialist.create({
      data: {
        name: input.name,
        role: input.role,
        description: input.description || '',
        model: input.model || '',
        capabilities: input.capabilities || [],
        active: input.active ?? true,
      },
      select: {
        id: true,
        name: true,
        role: true,
        description: true,
        model: true,
        capabilities: true,
        active: true,
        createdAt: true,
      },
    });

    res.status(201).json(specialist);
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
    const specialist = await prisma.specialist.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        role: true,
        description: true,
        model: true,
        capabilities: true,
        active: true,
        createdAt: true,
      },
    });

    if (!specialist) {
      res.status(404).json({ error: 'Specialist not found' });
      return;
    }

    res.json(specialist);
  } catch (error) {
    throw error;
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, role, description, model, capabilities, active } = req.body;

    const result = await prisma.specialist.updateMany({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(description !== undefined && { description }),
        ...(model !== undefined && { model }),
        ...(capabilities !== undefined && { capabilities }),
        ...(active !== undefined && { active }),
      },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Specialist not found' });
      return;
    }

    const updated = await prisma.specialist.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        role: true,
        description: true,
        model: true,
        capabilities: true,
        active: true,
        createdAt: true,
      },
    });

    res.json(updated);
  } catch (error) {
    throw error;
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await prisma.specialist.deleteMany({
      where: { id: req.params.id },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Specialist not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    throw error;
  }
});

export default router;
