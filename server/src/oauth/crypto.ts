import { env } from '../env.js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function getKeyMaterial(): Buffer {
  const secret = env.OAUTH_ENCRYPTION_KEY || env.SUPABASE_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('OAUTH_ENCRYPTION_KEY or SUPABASE_JWT_SECRET must be at least 32 characters');
  }
  return Buffer.from(secret.slice(0, KEY_LENGTH));
}

export function encryptToken(plaintext: string): string {
  const key = getKeyMaterial();
  const iv = randomBytes(IV_LENGTH);
  const salt = randomBytes(SALT_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(salt);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  return combined.toString('base64');
}

export function decryptToken(ciphertextBase64: string): string {
  const key = getKeyMaterial();
  const combined = Buffer.from(ciphertextBase64, 'base64');

  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(salt);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
