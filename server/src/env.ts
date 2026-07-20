import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// Load .env first, then .env.local for local overrides (both are gitignored)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Vercel's env var UI lets you add a key with an empty value, which shows up
// here as "" rather than being truly unset. zod's .optional()/.default()
// only kick in for undefined, so an empty string still fails a .url()/
// .email()/.uuid() check below — normalize "" to undefined first so a
// blank-but-present var behaves the same as an absent one.
const blankToUndefined = (val: unknown) => (val === "" ? undefined : val);

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  SUPABASE_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  SUPABASE_JWT_SECRET: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  OAUTH_ENCRYPTION_KEY: z.string().min(32, "OAUTH_ENCRYPTION_KEY must be at least 32 characters").optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_OAUTH_CLIENT_ID: z.string().optional(),
  MICROSOFT_OAUTH_CLIENT_SECRET: z.string().optional(),
  SLACK_OAUTH_CLIENT_ID: z.string().optional(),
  SLACK_OAUTH_CLIENT_SECRET: z.string().optional(),
  GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_MAP: z.string().optional(),
  PUBLIC_BASE_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o"),
  OPENROUTER_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GOOGLE_MODEL: z.string().min(1).default("gemini-2.0-flash"),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.string().default("development"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  // See middleware/auth.ts — real per-request auth is currently disabled;
  // every request is attached to this one user, which must exist as a real
  // Supabase auth.users row (profiles has a foreign key to it).
  DEMO_USER_ID: z.preprocess(blankToUndefined, z.string().uuid().default("00000000-0000-0000-0000-000000000000")),
  DEMO_USER_EMAIL: z.preprocess(blankToUndefined, z.string().email().default("demo@example.com")),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  console.error("Invalid environment variables:", parsed.error.format());
  throw new Error(`Invalid environment variables: ${details}`);
}

export const env = parsed.data;
