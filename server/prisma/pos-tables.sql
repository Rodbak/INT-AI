-- INT POS — schema additions (run once after coo-tables.sql)
--   psql "$DATABASE_URL" -f server/prisma/pos-tables.sql

-- Extend products with barcode + category
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "barcode"  text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "category" text;

-- Extend sales with POS fields
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "channel"   text NOT NULL DEFAULT 'manual';
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "discount"  double precision NOT NULL DEFAULT 0;
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "tax"       double precision NOT NULL DEFAULT 0;
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "tendered"  double precision;
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "change"    double precision;
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "cashierId" text;
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "shiftId"   text;
ALTER TABLE "SalesInvoice" ADD COLUMN IF NOT EXISTS "clientId"  text;
CREATE UNIQUE INDEX IF NOT EXISTS "SalesInvoice_clientId_key" ON "SalesInvoice" ("clientId");
CREATE INDEX IF NOT EXISTS "SalesInvoice_shiftId_idx" ON "SalesInvoice" ("shiftId");

CREATE TABLE IF NOT EXISTS "StoreSettings" (
  "id"             text PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId"    text NOT NULL UNIQUE,
  "taxEnabled"     boolean NOT NULL DEFAULT false,
  "taxRates"       jsonb,
  "taxInclusive"   boolean NOT NULL DEFAULT false,
  "barcodeEnabled" boolean NOT NULL DEFAULT false,
  "printerEnabled" boolean NOT NULL DEFAULT false,
  "cashDrawer"     boolean NOT NULL DEFAULT false,
  "receiptHeader"  text,
  "receiptFooter"  text DEFAULT 'Thank you! Come again.',
  "updatedAt"      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Cashier" (
  "id"          text PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" text NOT NULL,
  "name"        text NOT NULL,
  "pinHash"     text NOT NULL,
  "active"      boolean NOT NULL DEFAULT true,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "Cashier_workspaceId_idx" ON "Cashier" ("workspaceId");

CREATE TABLE IF NOT EXISTS "Shift" (
  "id"           text PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId"  text NOT NULL,
  "cashierId"    text NOT NULL REFERENCES "Cashier" ("id") ON DELETE CASCADE,
  "openingFloat" double precision NOT NULL DEFAULT 0,
  "openedAt"     timestamptz NOT NULL DEFAULT now(),
  "closedAt"     timestamptz,
  "countedCash"  double precision,
  "status"       text NOT NULL DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS "Shift_workspaceId_idx" ON "Shift" ("workspaceId");
