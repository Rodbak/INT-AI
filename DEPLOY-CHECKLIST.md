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

## 🚀 GO LIVE (new in `go-live-1`) — read this first

This build flips INT from shared-demo mode into a real product: a public
landing page, real per-owner accounts **on by default**, and no seeded data.
Phone-number login, Paystack payments and a custom domain come later — email +
password works now.

**1. Turn on email accounts in Supabase.** Supabase → Authentication → Providers
→ enable **Email**. The Email provider is on by default in new projects, so this
is usually already done. (Leave "Confirm email" on for verification, or off for
one-tap sign-up while you test.) `SUPABASE_JWT_SECRET` must be set (Supabase →
Settings → API → JWT Secret).

**2. Auth is ON by default now — no env flag needed.** The code defaults to real
accounts. You only touch these to *turn accounts off* again:
```
# To fall back to the old shared-demo mode (optional, not for production):
# AUTH_ENABLED=false
# VITE_AUTH_ENABLED=false
```
Leave them unset for the live product.

**3. Wipe the seeded demo shop** so the live database starts clean (Supabase →
SQL Editor, or `psql "$DATABASE_URL" -f server/prisma/wipe-demo.sql`). It removes
the demo owner and all its data; real sign-ups get their own fresh shops
automatically. Safe to run more than once.

**4. Set your support channels on the landing page.** In
`app/src/pages/LandingPage.tsx` change the two constants at the top before you
build:
```
const WHATSAPP_NUMBER = '233240000000';   // your WhatsApp, digits only, country code first
const SUPPORT_EMAIL   = 'hello@int.app';  // your support email
```

**5. Domain — later.** The app works on the Vercel URL now. When you buy a
domain, add it in Vercel → Settings → Domains and (if you enable phone/SMS or
Paystack) update those callback/webhook URLs to the new domain.

After sign-up, an owner lands on `/` → sees the landing page → "Create your shop"
→ fills name + shop name + email + password → gets their own isolated shop.

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

### Reseller billing — AI credits (new in `billing-1`)
Ships **off**. Shops buy credits (Mobile Money / card via Paystack); INT meters
each AI request against the wallet using your own model key.
1. One-time DB step (Supabase → SQL Editor, or `psql "$DATABASE_URL" -f server/prisma/billing-tables.sql`):
   ```sql
   ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "aiCredits" double precision NOT NULL DEFAULT 0;
   CREATE TABLE IF NOT EXISTS "CreditTransaction" (
     "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
     "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
     "type" text NOT NULL, "amount" double precision NOT NULL,
     "balanceAfter" double precision NOT NULL, "reference" text, "note" text,
     "createdAt" timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS "CreditTransaction_workspaceId_idx" ON "CreditTransaction"("workspaceId");
   ```
2. Env vars (add the Paystack keys whenever you're ready — the UI shows "payments being set up" until then):
   ```
   BILLING_ENABLED=true
   CREDITS_PER_CEDI=100        # GH₵1 = 100 credits (tune to your margin)
   AI_CREDIT_COST=1            # credits charged per AI request
   SIGNUP_BONUS_CREDITS=50     # free credits for a new shop
   PAYSTACK_SECRET_KEY=        ⟵ Paystack dashboard → Settings → API Keys (later)
   PAYSTACK_PUBLIC_KEY=        ⟵ same screen (later)
   ```
   In Paystack, set the **webhook URL** to `https://<your-domain>/api/credits/paystack/webhook`.
- With `BILLING_ENABLED` unset, all AI stays free and unmetered (current behaviour).
  The "AI Credits" panel in Settings only appears when billing is on.

### New in `supplier-1`
- **Camera barcode scanning** at the till (tap the camera icon by the search box) —
  uses the device camera; no hardware. Falls back to typing on unsupported browsers.
- **Supplier bills** on Money: record a restock invoice as paid / on credit / part-paid,
  attach a photo of the invoice, see what you owe suppliers, and pay bills down later.
  One-time DB step (Supabase → SQL Editor, or `psql "$DATABASE_URL" -f server/prisma/purchase-tables.sql`):
  ```sql
  CREATE TABLE IF NOT EXISTS "Purchase" (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
    "workspaceId" text NOT NULL, "supplier" text NOT NULL,
    "amount" double precision NOT NULL DEFAULT 0, "amountPaid" double precision NOT NULL DEFAULT 0,
    "status" text NOT NULL DEFAULT 'paid', "note" text, "photo" text,
    "createdAt" timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS "Purchase_workspaceId_idx" ON "Purchase" ("workspaceId");
  ```
  (Invoice photos are stored inline for now; moving them to Supabase Storage is a later optimization.)

### Turning on real accounts (new in `auth-1`)
Auth ships **off** so nothing breaks. To go live with real per-owner logins:
1. In **Supabase → Authentication → Providers**, enable **Email** and **Phone**.
   - For phone without SMS costs: turn **off** "Confirm phone" (owners sign up with
     phone + password immediately). Add an SMS provider later to require verification.
   - Email: leave "Confirm email" on (Supabase sends the confirmation) or off for speed.
2. Set env vars and redeploy:
   ```
   AUTH_ENABLED=true          # backend: verify real logins, isolate each shop
   VITE_AUTH_ENABLED=true     # frontend: show login, gate the app
   ```
   (`SUPABASE_JWT_SECRET` must be set — Supabase → Settings → API → JWT Secret.)
3. Each new sign-up (name + shop name + email/phone + password) automatically gets
   its **own** shop. Owners add cashiers with PINs as before.
- Leave both unset to stay in shared-demo mode. Flip them on only once you've
  confirmed sign-up/login works, so a deploy can't lock you out.

### New in `demo-1`
- **Reports date ranges** (Last 7 days / 30 days / This month / Last month) — no setup.
- **Receipt re-send / reprint** from any past sale in Sales history — no setup.
- **Barcode demo without hardware**: the till search box matches barcodes; type a
  seeded code (e.g. `6001005`) or a product name and press Enter to add it.
- **Richer demo data**: to load ~45 days of realistic daily sales (fuller charts,
  trends, busiest-day, forecasting), re-run the seed once:
  `npm --workspace server run coo:seed` (it resets the demo shop's data first).
  Skip it if you'd rather keep the current data.

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
