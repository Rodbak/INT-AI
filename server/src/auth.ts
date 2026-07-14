import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './db';
import type { AuthTokens, UserRole } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-me-refresh-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(user: { id: string; email: string; role: UserRole }): string {
  const payload: JWTPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function signRefreshToken(user: { id: string }): string {
  const payload: JWTPayload = {
    sub: user.id,
    email: '',
    role: 'user',
    type: 'refresh',
  };
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` });
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<{ sessionId: string; refreshToken: string }> {
  const refreshToken = signRefreshToken({ id: userId });
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  const session = await prisma.session.create({
    data: {
      userId,
      refreshToken,
      expiresAt,
    },
  });

  return { sessionId: session.id, refreshToken };
}

export async function refreshSession(oldRefreshToken: string): Promise<AuthTokens | null> {
  const payload = verifyRefreshToken(oldRefreshToken);
  if (!payload) return null;

  const session = await prisma.session.findUnique({
    where: { refreshToken: oldRefreshToken },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    await prisma.session.deleteMany({
      where: { userId: payload.sub, expiresAt: { lt: new Date() } },
    });
    return null;
  }

  await prisma.session.delete({ where: { id: session.id } });

  const accessToken = signAccessToken({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  });

  const newRefreshToken = signRefreshToken({ id: session.user.id });
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.session.create({
    data: {
      userId: session.user.id,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt,
    },
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: 15 * 60,
  };
}

export async function revokeSession(refreshToken: string): Promise<void> {
  await prisma.session.deleteMany({ where: { refreshToken } });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export function generateId(): string {
  return uuidv4();
}
