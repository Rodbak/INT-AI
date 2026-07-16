-- Enable Row Level Security on all remaining public tables (deny-all default
-- for the anon/authenticated roles used by Supabase's PostgREST Data API).
--
-- The app's backend connects via Prisma using the `postgres` role, which
-- bypasses RLS, so this does not affect the running application. It only
-- closes the auto-generated public REST API surface that this app never
-- uses for these tables -- previously anyone with the public anon key
-- (bundled into the deployed frontend as VITE_SUPABASE_ANON_KEY) could
-- read and write every row in every one of these tables directly, including
-- OAuth tokens in "Connection". Same reasoning already applied to "profiles"
-- in migrations/20260715105100_supabase_auth_sync.
--
-- Already applied directly to the live database on 2026-07-16 (production
-- runs migrations out-of-band from Vercel -- see vercel.json, which only
-- builds app/). This file exists so `prisma migrate deploy` stays in sync
-- for any future environment. Re-running it is a harmless no-op.

ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Connection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Prompt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Specialist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Automation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Team" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Model" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;

-- handle_new_user() is a trigger function (AFTER INSERT ON auth.users) and
-- was never meant to be callable directly -- Postgres rejects direct calls
-- to trigger functions outside of a trigger context regardless, but revoke
-- the RPC surface PostgREST exposes by default so it isn't reachable at all.
-- Postgres also grants EXECUTE to the PUBLIC pseudo-role on function
-- creation by default, which anon/authenticated inherit independent of any
-- grant/revoke targeted at them specifically -- revoke from PUBLIC directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
