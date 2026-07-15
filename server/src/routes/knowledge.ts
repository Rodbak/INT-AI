import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

const createDocumentSchema = z.object({
  title: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  url: z.string().min(1),
  workspaceId: z.string().min(1),
});

router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const memberships = await prisma.workspaceUser.findMany({
      where: { userId: req.user!.id },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    const where: any = { workspaceId: { in: workspaceIds } };
    if (typeof req.query.workspaceId === 'string' && req.query.workspaceId) {
      where.workspaceId = req.query.workspaceId;
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        uploader: { select: { id: true, email: true, name: true } },
        workspace: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(documents);
  } catch (error) {
    throw error;
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const input = createDocumentSchema.parse(req.body);

    const document = await prisma.document.create({
      data: {
        title: input.title,
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        url: input.url,
        workspaceId: input.workspaceId,
        uploadedBy: req.user!.id,
      },
    });

    res.status(201).json(document);
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
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, uploader: { id: req.user!.id } },
      include: {
        uploader: { select: { id: true, email: true, name: true } },
        workspace: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json(document);
  } catch (error) {
    throw error;
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await prisma.document.deleteMany({
      where: { id: req.params.id, uploader: { id: req.user!.id } },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    throw error;
  }
});

export default router;
