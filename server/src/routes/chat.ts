import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requestLogger } from '../middleware/logger.js';
import { RoutingEngine } from '../routing/engine.js';
import { calculateCost, countTokens, validateModelForProvider } from '../utils/cost.js';
import { createSSEResponse, sendSSEChunk, sendSSEEnd } from '../utils/stream.js';
import { retrieveRelevantChunks } from '../rag/retriever.js';
import type { AuthenticatedRequest, ChatRequest, StreamChunk, TaskType } from '../types.js';

const router = Router();
const routingEngine = new RoutingEngine();

const chatSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().uuid().optional(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    }),
  ).optional(),
  provider: z.enum(['anthropic', 'openai', 'google', 'openrouter']).optional(),
  model: z.string().optional(),
  stream: z.boolean().optional(),
});

router.use(requestLogger);
router.use(optionalAuth);
router.use(rateLimit);

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const input = chatSchema.parse(req.body);

    const messages = input.messages || [{ role: 'user', content: input.message }];
    const startTime = Date.now();

    const conversation = input.conversationId && req.user?.id
      ? await prisma.conversation.findFirst({
          where: { id: input.conversationId, userId: req.user.id },
        })
      : null;

    if (input.conversationId && !conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    let ragContext: string | undefined;
    if (req.user?.id) {
      try {
        const workspaceIds = await prisma.workspaceUser.findMany({
          where: { userId: req.user.id },
          select: { workspaceId: true },
        });

        const allChunks = await Promise.all(
          workspaceIds.map((w) => retrieveRelevantChunks(input.message, w.workspaceId, 2)),
        );

        const flattened = allChunks.flat().slice(0, 5);
        if (flattened.length > 0) {
          ragContext = flattened
            .map((c) => `[${c.metadata.documentTitle || 'Document'}]: ${c.content}`)
            .join('\n\n');
        }
      } catch {
        // RAG is optional, continue without context
      }
    }

    const context = {
      message: input.message,
      history: messages.slice(0, -1),
      userId: req.user?.id,
      conversationId: input.conversationId,
      preferredProvider: input.provider,
      preferredModel: input.model,
      ragContext,
    };

    const { chunks, decision } = await routingEngine.execute(context);

    if (input.stream) {
      createSSEResponse(res);

      let fullContent = '';
      let promptTokens = 0;
      let completionTokens = 0;
      let cost = 0;
      let taskType: TaskType = 'chat';

      try {
        for await (const chunk of chunks) {
          if (chunk.type === 'text') {
            fullContent += chunk.content || '';
            sendSSEChunk(res, { type: 'text', content: chunk.content });
          } else if (chunk.type === 'usage') {
            promptTokens = chunk.usage?.promptTokens || 0;
            completionTokens = chunk.usage?.completionTokens || 0;
            cost = chunk.usage?.cost || 0;
          } else if (chunk.type === 'error') {
            sendSSEChunk(res, { type: 'error', error: chunk.error });
            sendSSEEnd(res);
            return;
          } else if (chunk.type === 'done') {
            if (!cost && promptTokens > 0) {
              cost = calculateCost(decision.provider, promptTokens, completionTokens);
            }
            sendSSEChunk(res, {
              type: 'usage',
              usage: {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                cost,
              },
            });
            sendSSEEnd(res);
          }
        }
      } catch (error: any) {
        sendSSEChunk(res, { type: 'error', error: error.message || 'Stream error' });
        sendSSEEnd(res);
        return;
      }

      if (req.user?.id && conversation) {
        const promptTokensCount = countTokens(messages.map((m) => m.content).join(' '));
        const completionTokensCount = countTokens(fullContent);

        prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'user',
            content: input.message,
            provider: decision.provider,
            model: decision.model,
            tokensIn: promptTokensCount,
          },
        }).catch(() => {});

        prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: fullContent,
            provider: decision.provider,
            model: decision.model,
            tokensIn: promptTokensCount,
            tokensOut: completionTokensCount,
            cost,
          },
        }).catch(() => {});
      }
    } else {
      let fullContent = '';
      let promptTokens = 0;
      let completionTokens = 0;
      let cost = 0;

      try {
        for await (const chunk of chunks) {
          if (chunk.type === 'text') {
            fullContent += chunk.content || '';
          } else if (chunk.type === 'usage') {
            promptTokens = chunk.usage?.promptTokens || 0;
            completionTokens = chunk.usage?.completionTokens || 0;
            cost = chunk.usage?.cost || 0;
          } else if (chunk.type === 'error') {
            res.status(502).json({ error: chunk.error || 'Provider error' });
            return;
          }
        }
      } catch (error: any) {
        res.status(502).json({ error: error.message || 'Provider error' });
        return;
      }

      if (!cost && promptTokens > 0) {
        cost = calculateCost(decision.provider, promptTokens, completionTokens);
      }

      if (req.user?.id && conversation) {
        const promptTokensCount = countTokens(messages.map((m) => m.content).join(' '));
        const completionTokensCount = countTokens(fullContent);

        prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'user',
            content: input.message,
            provider: decision.provider,
            model: decision.model,
            tokensIn: promptTokensCount,
          },
        }).catch(() => {});

        prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: fullContent,
            provider: decision.provider,
            model: decision.model,
            tokensIn: promptTokensCount,
            tokensOut: completionTokensCount,
            cost,
          },
        }).catch(() => {});
      }

      res.json({
        reply: fullContent,
        provider: decision.provider,
        model: decision.model,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          cost,
        },
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    throw error;
  }
});

export default router;
