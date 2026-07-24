-- INT — AI credits wallet (reseller billing)
-- Run once against your database:
--   psql "$DATABASE_URL" -f server/prisma/billing-tables.sql

ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "aiCredits" double precision NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "CreditTransaction" (
  "id"           text PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId"  text NOT NULL REFERENCES "Workspace" ("id") ON DELETE CASCADE,
  "type"         text NOT NULL,
  "amount"       double precision NOT NULL,
  "balanceAfter" double precision NOT NULL,
  "reference"    text,
  "note"         text,
  "createdAt"    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "CreditTransaction_workspaceId_idx" ON "CreditTransaction" ("workspaceId");
