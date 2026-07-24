import express from 'express';
import cors from 'cors';
import { connectDb } from './db.js';
import { redis } from './utils/redis.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import { requestLogger } from './middleware/logger.js';
import authRoutes from './routes/auth.js';
import conversationRoutes from './routes/conversations.js';
import chatRoutes from './routes/chat.js';
import voiceRoutes from './routes/voice.js';
import modelsRoutes from './routes/models.js';
import specialistsRoutes from './routes/specialists.js';
import teamsRoutes from './routes/teams.js';
import automationsRoutes from './routes/automations.js';
import promptsRoutes from './routes/prompts.js';
import connectionsRoutes from './routes/connections.js';
import knowledgeRoutes from './routes/knowledge.js';
import uploadRoutes from './routes/uploads.js';
import workspacesRoutes from './routes/workspaces.js';
import usageRoutes from './routes/usage.js';
import billingRoutes from './routes/billing.js';
import adminRoutes from './routes/admin.js';
import adminModelsRoutes from './routes/adminModels.js';
import stripeWebhookRoutes from './routes/stripeWebhook.js';
import cooRoutes from './routes/coo.js';
import posRoutes from './routes/pos.js';
import pushRoutes from './routes/push.js';
import cronRoutes from './routes/cron.js';
import oauthRoutes from './oauth/router.js';
import { requestId } from './middleware/requestId.js';
import { env } from './env.js';

/**
 * The Express app itself, with no `.listen()` call and no static-frontend
 * serving. This is shared by two entry points:
 *  - src/index.ts, which adds static/SPA serving and calls .listen() for
 *    local dev and the Docker/self-host deployment path.
 *  - api/index.ts, the Vercel serverless function entry, where Vercel's
 *    own static hosting serves the frontend and this app only ever sees
 *    /api/* requests.
 */
export const app = express();

// CORS. On Vercel the frontend and this API are served from the SAME origin, so
// same-origin requests must always be allowed no matter how (or whether)
// CORS_ORIGINS is configured — otherwise the app can't call its own API. We use
// the request-aware delegate form so we can compare the Origin's host to the
// request Host and permit same-origin automatically. Real cross-origin callers
// are still restricted to the CORS_ORIGINS allowlist.
app.use(
  cors((req: express.Request, callback: (err: Error | null, options?: import('cors').CorsOptions) => void) => {
    const origin = req.header('Origin');
    const allowed = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
    // '*' is honoured only outside production (kept as a dev convenience).
    const wildcardOk = allowed.includes('*') && env.NODE_ENV !== 'production';

    let ok = false;
    if (!origin) {
      ok = true; // non-browser / same-origin GET with no Origin header
    } else if (wildcardOk || allowed.includes(origin)) {
      ok = true;
    } else {
      // Same-origin? Allow it — the Origin's host matches where the request landed.
      try {
        const host = req.header('X-Forwarded-Host') || req.header('Host');
        ok = new URL(origin).host === host;
      } catch {
        ok = false;
      }
    }
    callback(null, { origin: ok, credentials: true });
  }),
);
app.use(requestId);
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    await connectDb();
    const redisStatus = redis.status === 'ready' ? 'connected' : 'disconnected';
    res.json({
      status: 'ready',
      database: 'connected',
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({ status: 'not ready', database: 'disconnected', error: message });
  }
});

// Stripe needs the exact raw request bytes to verify the webhook signature,
// so this must be mounted (and parse its own body via express.raw()) before
// the global JSON body parser below consumes the stream.
app.use('/api/stripe', stripeWebhookRoutes);

app.use(express.json({ limit: '6mb' })); // 6mb: room for downscaled photo uploads (photo-to-inventory)
app.use(express.urlencoded({ extended: true, limit: '6mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/conversations', authenticate, conversationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/specialists', authenticate, specialistsRoutes);
app.use('/api/teams', authenticate, teamsRoutes);
app.use('/api/automations', authenticate, automationsRoutes);
app.use('/api/prompts', authenticate, promptsRoutes);
app.use('/api/connections', authenticate, connectionsRoutes);
app.use('/api/connections/oauth', oauthRoutes);
app.use('/api/coo', cooRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/workspaces', workspacesRoutes);
// Uploaded files: only durable/served correctly under the Docker/self-host
// path, where uploadDir is a persistent volume. On Vercel serverless, /tmp
// is ephemeral per-instance and not shared across invocations, so uploaded
// files are not reliably retrievable here — see DEPLOYMENT.md.
app.use('/uploads', express.static(env.NODE_ENV === 'production' ? '/tmp/uploads' : './uploads'));
app.use('/usage', usageRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/models', adminModelsRoutes);

// Scoped to /api so it never shadows the static/SPA-fallback routes that
// src/index.ts appends to this same app instance for local/Docker mode.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

export default app;
