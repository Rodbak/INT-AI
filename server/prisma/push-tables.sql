-- INT — push notification subscriptions
-- Run once against your database to create the table used for the daily
-- briefing push notifications:
--   psql "$DATABASE_URL" -f server/prisma/push-tables.sql
-- Defined as a Prisma model (PushSubscription) too; created here as raw SQL for
-- the same reason as coo-tables.sql (pgvector can trip `prisma db push`).

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id"          text PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" text NOT NULL,
  "endpoint"    text NOT NULL UNIQUE,
  "p256dh"      text NOT NULL,
  "auth"        text NOT NULL,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "PushSubscription_workspaceId_idx" ON "PushSubscription" ("workspaceId");
