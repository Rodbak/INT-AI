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
import { meterAI } from '../billing/wallet.js';
import { buildSpecialistPrompt, resolveModelForProviders, type SpecialistLike } from '../routing/specialist.js';
import { buildPlatformIdentity, availableProviders, loadPlatformRoster } from '../routing/platform.js';
import { computeBrief } from './coo.js';
import type { AuthenticatedRequest, ChatMessage, ChatRequest, StreamChunk, TaskType } from '../types.js';

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
  specialistId: z.string().optional(),
  regenerate: z.boolean().optional(),
  stream: z.boolean().optional(),
  // Image data URLs (data:image/...;base64,...) for vision.
  images: z.array(z.string()).max(4).optional(),
});

router.use(requestLogger);
router.use(optionalAuth);
router.use(rateLimit);

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const input = chatSchema.parse(req.body);

    // Reseller billing: charge one AI credit per message (no-op when billing is
    // off). Out of credits → a clear 402 the client shows as a "top up" prompt.
    if (req.user?.id) {
      const wsRow = await prisma.workspaceUser.findFirst({ where: { userId: req.user.id }, select: { workspaceId: true } });
      if (wsRow && !(await meterAI(wsRow.workspaceId, 'chat message'))) {
        res.status(402).json({ error: 'You’re out of AI credits. Top up in Settings to keep chatting with INT.' });
        return;
      }
    }

    // Vercel's function-builder type-check has, across several deployments,
    // inferred an overly-loose (optional role/content) shape for
    // input.messages that plain `tsc --noEmit` here never reproduces —
    // build each ChatMessage explicitly instead of relying on the zod-
    // inferred array being structurally assignable to ChatMessage[].
    const messages: ChatMessage[] =
      input.messages && input.messages.length > 0
        ? input.messages.map(
            (m): ChatMessage => ({ role: m.role ?? 'user', content: m.content ?? '' }),
          )
        : [{ role: 'user', content: input.message }];
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

    // Regenerate: drop the most recent assistant reply so the new one replaces
    // it instead of piling up. The user message is left in place and not
    // re-persisted below.
    if (input.regenerate && conversation) {
      const lastAssistant = await prisma.message.findFirst({
        where: { conversationId: conversation.id, role: 'assistant' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (lastAssistant) {
        await prisma.message.delete({ where: { id: lastAssistant.id } }).catch(() => {});
      }
    }

    let ragContext: string | undefined;
    let sources: { n: number; title: string; documentId?: string }[] = [];
    if (req.user?.id) {
      try {
        const workspaceIds = await prisma.workspaceUser.findMany({
          where: { userId: req.user.id },
          select: { workspaceId: true },
        });

        const allChunks = await Promise.all(
          workspaceIds.map((w) => retrieveRelevantChunks(input.message, w.workspaceId, 3)),
        );

        const flattened = allChunks.flat().slice(0, 5);
        if (flattened.length > 0) {
          // Number the sources so the model can cite them as [1], [2], … and the
          // UI can list them under the answer.
          ragContext = flattened
            .map((c, i) => `[${i + 1}] (${c.metadata.documentTitle || 'Document'}):\n${c.content}`)
            .join('\n\n');
          sources = flattened.map((c, i) => ({
            n: i + 1,
            title: c.metadata.documentTitle || 'Document',
            documentId: c.metadata.documentId,
          }));
        }
      } catch {
        // RAG is optional, continue without context
      }
    }

    // Resolve a specialist: either the one the user picked, or auto-select the
    // best active specialist for the request. A specialist contributes its
    // persona system prompt and its preferred model/provider.
    let specialist: SpecialistLike | null = null;
    if (input.specialistId && input.specialistId !== 'auto') {
      specialist = await prisma.specialist.findFirst({
        where: { id: input.specialistId, active: true },
        select: { id: true, name: true, role: true, description: true, model: true, capabilities: true },
      });
    } else if (input.specialistId === 'auto') {
      const actives = await prisma.specialist.findMany({
        where: { active: true },
        select: { id: true, name: true, role: true, description: true, model: true, capabilities: true },
      });
      if (actives.length) {
        const text = input.message.toLowerCase();
        // Lightweight keyword match against role/capabilities; fall back to first.
        specialist =
          actives.find((s) => {
            const hay = `${s.role} ${(Array.isArray(s.capabilities) ? (s.capabilities as string[]).join(' ') : '')}`.toLowerCase();
            return hay.split(/\W+/).some((w) => w.length > 3 && text.includes(w));
          }) || actives[0];
      }
    }

    let preferredProvider = input.provider;
    let preferredModel = input.model;

    // Ground every turn with INT AI's self-knowledge, assembled from live state
    // (which providers have keys, which specialists/teams exist) so the
    // assistant can accurately explain what it is and how it works.
    const providers = availableProviders();
    const roster = await loadPlatformRoster();
    const platformIdentity = buildPlatformIdentity({
      availableProviders: providers,
      specialists: roster.specialists,
      teams: roster.teams,
      activeSpecialist: specialist ? { name: specialist.name, role: specialist.role } : null,
    });

    const systemParts: string[] = [platformIdentity];
    if (specialist) {
      systemParts.push(buildSpecialistPrompt(specialist));
      // Only fill in from the specialist when the user didn't pick a model. Its
      // pinned model is re-routed through OpenRouter if its native provider has
      // no key, so a specialist still answers on an OpenRouter-only setup.
      if (specialist.model && !preferredModel) {
        const resolved = resolveModelForProviders(specialist.model, providers);
        preferredModel = resolved.model;
        preferredProvider = resolved.provider;
      }
    }
    // Ground INT as the owner's COO with the live business snapshot, so
    // questions like "who hasn't paid?" are answered from real records.
    try {
      const ws = req.user?.id
        ? await prisma.workspaceUser.findFirst({ where: { userId: req.user.id }, select: { workspace: { select: { id: true, name: true } } } }).then((m) => m?.workspace)
        : await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
      if (ws?.id) {
        const b = await computeBrief(ws.id);
        const shop = ws.name && !/^(my |default )?workspace$/i.test(ws.name) ? ws.name : null;
        const owes = b.receivables
          .map((r) => `${r.customer} GH₵${r.outstanding}${r.daysOverdue > 0 ? ` (${r.daysOverdue}d overdue)` : ''}`)
          .join('; ');
        systemParts.push(
          `# ${shop ? `${shop} — the` : 'The'} owner's business right now (real figures, GH₵)\n` +
            (shop ? `The shop is called "${shop}". Greet the owner warmly by this name when it fits.\n` : '') +
            `Cash on hand: GH₵ ${b.cashOnHand}. Runway: ${b.cashRunwayWeeks ?? '—'} weeks. ` +
            `Owed to you: GH₵ ${b.receivablesTotal} across ${b.receivablesCount} customers. ` +
            `Sales this week: GH₵ ${b.salesThisWeek}${b.trendPct != null ? ` (${b.trendPct >= 0 ? '+' : ''}${b.trendPct}% vs last week)` : ''}. ` +
            (b.bestSeller ? `Best seller: ${b.bestSeller.name} (${b.bestSeller.marginPct}% margin). ` : '') +
            (b.lowStock.length ? `Low stock: ${b.lowStock.map((p) => `${p.name} (${p.stock} left)`).join(', ')}. ` : '') +
            `\nWho owes: ${owes || 'nobody'}.\n` +
            `Answer from these real figures only, warmly and briefly, in cedis, and finish with one friendly next step. ` +
            `Never invent numbers; if something isn't here, say so kindly and point them to where to add it.`,
        );
      }
    } catch {
      /* business context is optional */
    }

    const systemPrompt = systemParts.join('\n\n');

    // Images require a vision-capable model. If the user didn't explicitly pick
    // one, route the turn through an OpenRouter vision model.
    const hasImages = Array.isArray(input.images) && input.images.length > 0;
    if (hasImages && !input.model && providers.includes('openrouter')) {
      preferredProvider = 'openrouter';
      preferredModel = 'openai/gpt-4o';
    }

    const context = {
      message: input.message,
      history: messages.slice(0, -1),
      userId: req.user?.id,
      conversationId: input.conversationId,
      preferredProvider,
      preferredModel,
      ragContext,
      systemPrompt,
      images: hasImages ? input.images : undefined,
    };

    const { chunks, decision } = await routingEngine.execute(context);

    if (input.stream) {
      createSSEResponse(res);

      // Tell the client which specialist/model is handling this turn so it can
      // show a "handled by" badge and light up the right neuron.
      res.write(
        `data: ${JSON.stringify({
          type: 'meta',
          specialist: specialist ? { id: specialist.id, name: specialist.name } : null,
          provider: decision.provider,
          model: decision.model,
          reasoning: decision.reasoning,
        })}\n\n`,
      );

      if (sources.length > 0) {
        res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);
      }

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

        if (!input.regenerate) {
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
        }

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

        if (!input.regenerate) {
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
        }

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
        specialist: specialist ? { id: specialist.id, name: specialist.name } : null,
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
