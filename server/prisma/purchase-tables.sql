-- INT — supplier bills / purchases
-- Run once against your database:
--   psql "$DATABASE_URL" -f server/prisma/purchase-tables.sql

CREATE TABLE IF NOT EXISTS "Purchase" (
  "id"          text PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" text NOT NULL,
  "supplier"    text NOT NULL,
  "amount"      double precision NOT NULL DEFAULT 0,
  "amountPaid"  double precision NOT NULL DEFAULT 0,
  "status"      text NOT NULL DEFAULT 'paid',
  "note"        text,
  "photo"       text,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "Purchase_workspaceId_idx" ON "Purchase" ("workspaceId");
