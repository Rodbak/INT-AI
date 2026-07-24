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
  SUPABASE_JWT_SECRET: z.string().min(1, "SUPABASE_JWT_SECRET is required"),
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
  // When "1"/"true", API error responses include the real error message and
  // stack (handy while building/debugging in a deployed environment). Leave
  // unset in production so only a generic message is returned to clients.
  DEBUG_ERRORS: z.string().optional(),
  // See middleware/auth.ts — real per-request auth is currently disabled;
  // every request is attached to this one user, which must exist as a real
  // Supabase auth.users row (profiles has a foreign key to it).
  DEMO_USER_ID: z.preprocess(blankToUndefined, z.string().uuid().default("00000000-0000-0000-0000-000000000000")),
  DEMO_USER_EMAIL: z.preprocess(blankToUndefined, z.string().email().default("demo@example.com")),
  // Turn on real per-user auth (Supabase Auth). When unset/false the app stays
  // in shared-demo mode (one shop). Set AUTH_ENABLED=true only once you've
  // confirmed sign-up/login works, so a deploy can't lock you out.
  AUTH_ENABLED: z.preprocess(blankToUndefined, z.string().optional()),
  // Reseller billing (AI credits wallet + Paystack). Off by default. When on,
  // AI features check/deduct credits. Paystack keys can be added later.
  BILLING_ENABLED: z.preprocess(blankToUndefined, z.string().optional()),
  PAYSTACK_SECRET_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  PAYSTACK_PUBLIC_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  // Credits granted per GH₵ paid (e.g. 100 → GH₵1 buys 100 credits).
  CREDITS_PER_CEDI: z.coerce.number().positive().default(100),
  // Credits charged per AI request (chat message, draft, photo scan, insight).
  AI_CREDIT_COST: z.coerce.number().nonnegative().default(1),
  // Free credits handed to a brand-new shop so they can try INT.
  SIGNUP_BONUS_CREDITS: z.coerce.number().nonnegative().default(50),
  // Web-push (daily briefing to the owner's phone). Generate a keypair once
  // with `node -e "console.log(require('web-push').generateVAPIDKeys())"` and
  // set both. When unset, push is simply disabled (the app still works).
  VAPID_PUBLIC_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  VAPID_PRIVATE_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  VAPID_SUBJECT: z.string().default("mailto:owner@example.com"),
  // Shared secret that guards the scheduled briefing endpoint. On Vercel, set
  // CRON_SECRET and Vercel automatically sends it as a Bearer token on cron
  // requests. When unset, the cron endpoint is disabled (returns 503).
  CRON_SECRET: z.preprocess(blankToUndefined, z.string().optional()),
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
