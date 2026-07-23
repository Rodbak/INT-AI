# INT — Go-live checklist (Vercel + Supabase)

The Supabase database is already provisioned, migrated to the current schema, and
seeded with a demo shop. You only need to (1) push this code and (2) set env vars.

## 1. Push the code
Push this repository to `rodbak/int-ai` (branch `main`). Vercel is connected to the
repo and auto-builds on push.

### One-time DB step for phone notifications (new in `proactive-1`)
The daily-briefing push needs one new table. Run this once in Supabase → SQL Editor
(or `psql "$DATABASE_URL" -f server/prisma/push-tables.sql`):

```sql
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id"          text PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" text NOT NULL,
  "endpoint"    text NOT NULL UNIQUE,
  "p256dh"      text NOT NULL,
  "auth"        text NOT NULL,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "PushSubscription_workspaceId_idx" ON "PushSubscription" ("workspaceId");
```

Everything else in the DB is already migrated and seeded. If you skip this step the app
still runs — only the phone-notification feature stays off.

## 2. Vercel → int-ai → Settings → Environment Variables
Set these (Production). Values you must supply are marked ⟵.

```
# Frontend (build-time)
VITE_SUPABASE_URL=https://hkdzljeqtmsnwvzeulwe.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_mbSMTswZmFlR58YePk_wEA_v4hH_ml2
VITE_API_URL=

# Backend (serverless)
OPENROUTER_API_KEY=            ⟵ your OpenRouter key (powers "Ask INT" + proactive drafts)
SUPABASE_URL=https://hkdzljeqtmsnwvzeulwe.supabase.co
DATABASE_URL=                  ⟵ Supabase → Connect → ORMs → Prisma  (pooled, :6543, ?pgbouncer=true)
DIRECT_URL=                    ⟵ same screen (direct connection, :5432)
NODE_ENV=production

# Phone notifications (daily briefing push) — new in proactive-1.
# These keys are pre-generated for you; paste them as-is. Leave them unset to
# keep push disabled (the rest of the app is unaffected).
VAPID_PUBLIC_KEY=BEaO0zqkLEgIptaq8h0CyBvFYsZdgYqszv_sqHpN5xb7RCChOmYekvhTjCHtjNn0KwfNpNd9K_ROVO06mSmvqGk
VAPID_PRIVATE_KEY=KyJ1Qyu3LF7a1MZWrKITeVDTFXFTIB__lx2OZPvoicA
VAPID_SUBJECT=mailto:you@yourshop.com          ⟵ change to your email
CRON_SECRET=c0b2bcae4ae76038e0a289eeef6adf8701ec0d602cba2053
```

Everything else in `server/.env.example` (Google/Slack/Stripe/OpenAI/Anthropic/Redis)
is **optional** — the app runs without them.

### New in `trust-vision-1`
- **Customer trust score** is automatic — no setup, no keys. It reads existing
  payment history and shows a badge on each customer + a gentle warning when you
  sell on credit to a slow payer.
- **Photo-to-inventory** (Stock → "Scan a photo") uses your `OPENROUTER_API_KEY`.
  The button only appears when that key is set. To pick a specific vision model,
  set `OPENROUTER_VISION_MODEL` (defaults to `anthropic/claude-3.5-sonnet`).

### New in `money-capture-1`
- **Log from a MoMo/bank message** (Money → "From a MoMo message"): paste an SMS
  and INT reads the amount, direction and sender. Works **without any key** (a
  deterministic parser handles MTN/Telecel/AirtelTigo/bank formats); your
  `OPENROUTER_API_KEY` is only a fallback for unusual messages. Money **in** always
  asks how to file it (debt payment / sale / other cash-in) — money taken at the
  till stays a normal cash-in and doesn't go through here. Money **out** is
  proposed as an expense with a suggested category to confirm.
- This is phase 1 of money automation. Phase 2 (a payment-provider API for
  hands-free ingestion) and phase 3 (an Android SMS companion) are planned next.

### About the daily briefing schedule
`vercel.json` already declares two cron jobs (Vercel → your project runs them automatically):
- **07:00 Accra** → morning stand-up push
- **19:00 Accra** → end-of-day recap push

Ghana is on GMT year-round, so these are `0 7` and `0 19` UTC. Vercel Cron needs a
**Pro** plan for multiple daily runs; on Hobby you get one run/day. The owner opts a
phone in from **Home → "Get your daily summary on this phone" → Turn on** (installs the
app to the home screen first for best results on Android; iOS needs iOS 16.4+ and the
app added to the Home Screen).

## 3. Redeploy
After saving the env vars, trigger a redeploy (Vercel → Deployments → ⋯ → Redeploy)
so the build picks them up.

## Notes
- **Database security:** the public REST roles (`anon`, `authenticated`) have no table
  access; all data goes through the backend using `DATABASE_URL`. Don't re-grant them.
- **Login:** currently single-shop demo mode (one shared workspace). Multi-tenant
  sign-up is the next step when you want many stores.
- **Demo cashier for the Till:** Akosua · PIN **1234**.
- **Verify the live build:** the sidebar footer shows the build tag; the browser console
  logs `INT build: …` on load.
