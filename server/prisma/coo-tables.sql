-- INT AI COO — business data tables
-- Run this once against your database to create the AI-COO tables.
--   psql "$DATABASE_URL" -f server/prisma/coo-tables.sql
--
-- These are defined as Prisma models in schema.prisma too, but `prisma db push`
-- can fail on the pgvector column used elsewhere (P4002), so create them with
-- this raw SQL instead. Column names are camelCase to match Prisma's mapping.

CREATE TABLE IF NOT EXISTS "Product" (
  "id"           text PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId"  text NOT NULL,
  "name"         text NOT NULL,
  "sku"          text,
  "price"        double precision NOT NULL,
  "cost"         double precision NOT NULL,
  "stock"        integer NOT NULL DEFAULT 0,
  "reorderPoint" integer NOT NULL DEFAULT 0,
  "unit"         text NOT NULL DEFAULT 'unit',
  "createdAt"    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "Product_workspaceId_idx" ON "Product" ("workspaceId");

CREATE TABLE IF NOT EXISTS "Customer" (
  "id"          text PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" text NOT NULL,
  "name"        text NOT NULL,
  "phone"       text,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "Customer_workspaceId_idx" ON "Customer" ("workspaceId");

CREATE TABLE IF NOT EXISTS "SalesInvoice" (
  "id"          text PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" text NOT NULL,
  "customerId"  text NOT NULL REFERENCES "Customer" ("id") ON DELETE CASCADE,
  "number"      text NOT NULL,
  "amount"      double precision NOT NULL,
  "status"      text NOT NULL DEFAULT 'unpaid',
  "issuedAt"    timestamptz NOT NULL DEFAULT now(),
  "dueAt"       timestamptz NOT NULL,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "SalesInvoice_workspaceId_idx" ON "SalesInvoice" ("workspaceId");

CREATE TABLE IF NOT EXISTS "SalesInvoiceItem" (
  "id"        text PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoiceId" text NOT NULL REFERENCES "SalesInvoice" ("id") ON DELETE CASCADE,
  "productId" text NOT NULL REFERENCES "Product" ("id") ON DELETE CASCADE,
  "qty"       integer NOT NULL,
  "unitPrice" double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS "SalesInvoiceItem_invoiceId_idx" ON "SalesInvoiceItem" ("invoiceId");

CREATE TABLE IF NOT EXISTS "Payment" (
  "id"          text PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" text NOT NULL,
  "invoiceId"   text REFERENCES "SalesInvoice" ("id") ON DELETE SET NULL,
  "customerId"  text REFERENCES "Customer" ("id") ON DELETE SET NULL,
  "amount"      double precision NOT NULL,
  "method"      text NOT NULL DEFAULT 'cash',
  "receivedAt"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "Payment_workspaceId_idx" ON "Payment" ("workspaceId");

CREATE TABLE IF NOT EXISTS "Expense" (
  "id"          text PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" text NOT NULL,
  "category"    text NOT NULL,
  "amount"      double precision NOT NULL,
  "note"        text,
  "spentAt"     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "Expense_workspaceId_idx" ON "Expense" ("workspaceId");

CREATE TABLE IF NOT EXISTS "CooAction" (
  "id"          text PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" text NOT NULL,
  "kind"        text NOT NULL,
  "title"       text NOT NULL,
  "detail"      text,
  "status"      text NOT NULL DEFAULT 'pending',
  "payload"     jsonb,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "CooAction_workspaceId_idx" ON "CooAction" ("workspaceId");
