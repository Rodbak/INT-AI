import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

const createModelSchema = z.object({
  name: z.string().min(1),
  provider: z.string().min(1),
  description: z.string().optional(),
  contextWindow: z.number().int().positive(),
  inputPricePerMillion: z.number().nonnegative(),
  outputPricePerMillion: z.number().nonnegative(),
  capabilities: z.array(z.string()).optional(),
  active: z.boolean().default(true),
});

const updateModelSchema = z.object({
  name: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  description: z.string().optional(),
  contextWindow: z.number().int().positive().optional(),
  inputPricePerMillion: z.number().nonnegative().optional(),
  outputPricePerMillion: z.number().nonnegative().optional(),
  capabilities: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

router.use(authenticate);
router.use(adminOnly);

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const models = await prisma.model.findMany({
      orderBy: { name: 'asc' },
    });

    res.json(models);
  } catch (error) {
    throw error;
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const input = createModelSchema.parse(req.body);

    const model = await prisma.model.create({
      data: {
        name: input.name,
        provider: input.provider,
        description: input.description || '',
        contextWindow: input.contextWindow,
        inputPricePerMillion: input.inputPricePerMillion,
        outputPricePerMillion: input.outputPricePerMillion,
        capabilities: input.capabilities || [],
        active: input.active,
      },
    });

    res.status(201).json(model);
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
    const input = updateModelSchema.parse(req.body);

    const model = await prisma.model.update({
      where: { id: req.params.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.provider !== undefined && { provider: input.provider }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.contextWindow !== undefined && { contextWindow: input.contextWindow }),
        ...(input.inputPricePerMillion !== undefined && { inputPricePerMillion: input.inputPricePerMillion }),
        ...(input.outputPricePerMillion !== undefined && { outputPricePerMillion: input.outputPricePerMillion }),
        ...(input.capabilities !== undefined && { capabilities: input.capabilities }),
        ...(input.active !== undefined && { active: input.active }),
      },
    });

    res.json(model);
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
    await prisma.model.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    throw error;
  }
});

export default router;
