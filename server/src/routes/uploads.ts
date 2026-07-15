import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { env } from '../env.js';
import { existsSync, mkdirSync } from 'node:fs';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

const uploadDir = env.NODE_ENV === 'production' ? '/tmp/uploads' : './uploads';
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'doc',
  'application/msword': 'doc',
  'text/plain': 'text',
  'text/markdown': 'text',
  'application/json': 'text',
  'text/csv': 'sheet',
  'application/vnd.ms-excel': 'sheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'sheet',
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME_TYPES[file.mimetype] || 'bin';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
});

router.use(authenticate);

const uploadSchema = z.object({
  workspaceId: z.string().min(1),
});

router.post('/', upload.array('files', 5), async (req: AuthenticatedRequest, res) => {
  try {
    const input = uploadSchema.parse(req.body);

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

    const files = (req as any).files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    const documents = await Promise.all(
      files.map(async (file) => {
        const ext = ALLOWED_MIME_TYPES[file.mimetype] || 'bin';
        const url = `/uploads/${file.filename}`;

        return prisma.document.create({
          data: {
            title: file.originalname,
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url,
            workspaceId: input.workspaceId,
            uploadedBy: req.user!.id,
          },
          select: {
            id: true,
            title: true,
            filename: true,
            mimeType: true,
            size: true,
            url: true,
            workspaceId: true,
            uploadedBy: true,
            createdAt: true,
            updatedAt: true,
            uploader: {
              select: { id: true, email: true, name: true },
            },
            workspace: {
              select: { id: true, name: true, slug: true },
            },
          },
        });
      }),
    );

    res.status(201).json(documents);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'File too large. Maximum size is 25MB.' });
        return;
      }
      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        res.status(400).json({ error: 'Too many files. Maximum is 5 per request.' });
        return;
      }
    }
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id,
        uploader: { id: req.user!.id },
      },
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
      where: {
        id: req.params.id,
        uploader: { id: req.user!.id },
      },
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
