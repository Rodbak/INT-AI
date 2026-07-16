import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { getOAuthConfig, type OAuthProviderConfig } from './config.js';
import { encryptToken, decryptToken } from './crypto.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

router.get('/authorize/:provider', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const provider = req.params.provider;
    const config = getOAuthConfig(provider);
    if (!config) {
      res.status(400).json({ error: `Unsupported provider: ${provider}` });
      return;
    }

    const workspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
    if (!workspaceId) {
      res.status(400).json({ error: 'workspaceId is required' });
      return;
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        users: { some: { userId: req.user!.id } },
      },
    });

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    const state = generateState();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.oAuthState.create({
      data: {
        state,
        provider,
        userId: req.user!.id,
        workspaceId,
        expiresAt,
      },
    });

    const authUrl = buildAuthUrl(config, state);
    res.json({ authUrl, state });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    throw error;
  }
});

router.get('/callback/:provider', async (req: any, res: Response) => {
  try {
    const provider = req.params.provider;
    const config = getOAuthConfig(provider);
    if (!config) {
      res.status(400).json({ error: `Unsupported provider: ${provider}` });
      return;
    }

    const { code, state } = req.query;
    if (typeof code !== 'string' || typeof state !== 'string') {
      res.status(400).json({ error: 'Missing code or state parameter' });
      return;
    }

    const stateRecord = await prisma.oAuthState.findFirst({
      where: { state, provider, used: false },
      include: { user: true },
    });

    if (!stateRecord || stateRecord.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invalid or expired state parameter' });
      return;
    }

    const tokenResponse = await exchangeCodeForToken(config, code);
    const tokens = await refreshAccessTokenIfNeeded(config, tokenResponse);

    await prisma.oAuthState.update({
      where: { id: stateRecord.id },
      data: { used: true },
    });

    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    const connection = await prisma.connection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: stateRecord.workspaceId,
          provider: provider as any,
        },
      },
      update: {
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Connection`,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        status: 'connected',
      },
      create: {
        provider: provider as any,
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Connection`,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        workspaceId: stateRecord.workspaceId,
        userId: stateRecord.userId,
        status: 'connected',
      },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        expiresAt: true,
        workspaceId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    res.json(connection);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(502).json({ error: 'OAuth callback failed' });
  }
});

router.post('/refresh/:provider/:connectionId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const provider = req.params.provider;
    const connectionId = req.params.connectionId;
    const config = getOAuthConfig(provider);

    if (!config) {
      res.status(400).json({ error: `Unsupported provider: ${provider}` });
      return;
    }

    const connection = await prisma.connection.findFirst({
      where: {
        id: connectionId,
        workspace: { users: { some: { userId: req.user!.id } } },
      },
    });

    if (!connection || !connection.refreshToken) {
      res.status(404).json({ error: 'Connection not found or not refreshable' });
      return;
    }

    const decryptedRefreshToken = decryptToken(connection.refreshToken);
    const tokenResponse = await refreshAccessToken(config, decryptedRefreshToken);
    const tokens = await refreshAccessTokenIfNeeded(config, tokenResponse);

    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : connection.refreshToken;

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : connection.expiresAt;

    const updated = await prisma.connection.update({
      where: { id: connectionId },
      data: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        status: 'connected',
      },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        expiresAt: true,
        workspaceId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(502).json({ error: 'Token refresh failed' });
  }
});

function buildAuthUrl(config: OAuthProviderConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri(process.env.PUBLIC_BASE_URL || 'http://localhost:3001'),
    response_type: 'code',
    scope: config.scope,
    state,
    ...config.extraAuthParams,
  });
  return `${config.authUrl}?${params.toString()}`;
}

async function exchangeCodeForToken(config: OAuthProviderConfig, code: string): Promise<any> {
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri(process.env.PUBLIC_BASE_URL || 'http://localhost:3001'),
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  return response.json();
}

async function refreshAccessToken(config: OAuthProviderConfig, refreshToken: string): Promise<any> {
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  return response.json();
}

async function refreshAccessTokenIfNeeded(config: OAuthProviderConfig, tokenResponse: any): Promise<any> {
  if (tokenResponse.access_token && !tokenResponse.expires_in) {
    return tokenResponse;
  }
  return tokenResponse;
}

export default router;
