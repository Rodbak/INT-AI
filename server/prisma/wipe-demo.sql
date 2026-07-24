-- ============================================================================
-- INT — Wipe the seeded demo shop before going live
-- ============================================================================
-- Removes the demo owner and ALL business data in the workspace(s) that demo
-- owner belongs to, so your live app starts completely clean. Real owners who
-- sign up get their OWN separate workspaces, which this script never touches.
--
-- Safe to run more than once. Run it in Supabase → SQL Editor, or:
--   psql "$DATABASE_URL" -f server/prisma/wipe-demo.sql
--
-- The demo owner id below is the default DEMO_USER_ID. If you set a custom
-- DEMO_USER_ID env, change it here too.
-- ============================================================================

BEGIN;

-- Collect the demo owner's workspace ids (real shops are excluded).
CREATE TEMP TABLE _demo_ws ON COMMIT DROP AS
  SELECT "workspaceId" AS id
  FROM "WorkspaceUser"
  WHERE "userId" = '00000000-0000-0000-0000-000000000000';

-- Sale line items (child of both SalesInvoice and Product).
DELETE FROM "SalesInvoiceItem"
  WHERE "invoiceId" IN (SELECT id FROM "SalesInvoice" WHERE "workspaceId" IN (SELECT id FROM _demo_ws));

-- Business rows keyed by workspace.
DELETE FROM "Payment"           WHERE "workspaceId" IN (SELECT id FROM _demo_ws);
DELETE FROM "SalesInvoice"      WHERE "workspaceId" IN (SELECT id FROM _demo_ws);
DELETE FROM "Shift"             WHERE "workspaceId" IN (SELECT id FROM _demo_ws);
DELETE FROM "Cashier"           WHERE "workspaceId" IN (SELECT id FROM _demo_ws);
DELETE FROM "Expense"           WHERE "workspaceId" IN (SELECT id FROM _demo_ws);
DELETE FROM "Purchase"          WHERE "workspaceId" IN (SELECT id FROM _demo_ws);
DELETE FROM "CooAction"         WHERE "workspaceId" IN (SELECT id FROM _demo_ws);
DELETE FROM "StoreSettings"     WHERE "workspaceId" IN (SELECT id FROM _demo_ws);
DELETE FROM "PushSubscription"  WHERE "workspaceId" IN (SELECT id FROM _demo_ws);
DELETE FROM "CreditTransaction" WHERE "workspaceId" IN (SELECT id FROM _demo_ws);
DELETE FROM "Product"           WHERE "workspaceId" IN (SELECT id FROM _demo_ws);
DELETE FROM "Customer"          WHERE "workspaceId" IN (SELECT id FROM _demo_ws);

-- Chat history for the demo owner (Message rows cascade from Conversation).
DELETE FROM "Conversation" WHERE "userId" = '00000000-0000-0000-0000-000000000000';

-- Membership, then the empty workspace(s), then the demo profile.
DELETE FROM "WorkspaceUser" WHERE "workspaceId" IN (SELECT id FROM _demo_ws);
DELETE FROM "Workspace"     WHERE id IN (SELECT id FROM _demo_ws);
DELETE FROM "profiles"      WHERE id = '00000000-0000-0000-0000-000000000000';

COMMIT;

-- After this, the database has no demo data. The first real sign-up creates a
-- fresh workspace automatically (server/src/auth/context.ts::ensureUserContext).
