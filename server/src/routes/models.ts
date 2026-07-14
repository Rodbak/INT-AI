import { Router } from 'express';
import { prisma } from '../db';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const models = await prisma.model.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        provider: true,
        description: true,
        contextWindow: true,
        inputPricePerMillion: true,
        outputPricePerMillion: true,
        capabilities: true,
        active: true,
      },
    });

    res.json(models);
  } catch (error) {
    throw error;
  }
});

export default router;
