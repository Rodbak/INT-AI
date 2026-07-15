import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_JWT_SECRET: z.string().min(1, "SUPABASE_JWT_SECRET is required"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-4-5-20250929"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o"),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GOOGLE_MODEL: z.string().min(1).default("gemini-2.0-flash"),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.string().default("development"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.format());
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
