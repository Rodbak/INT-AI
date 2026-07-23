# INT — Go-live checklist (Vercel + Supabase)

The Supabase database is already provisioned, migrated to the current schema, and
seeded with a demo shop. You only need to (1) push this code and (2) set env vars.

## 1. Push the code
Push this repository to `rodbak/int-ai` (branch `main`). Vercel is connected to the
repo and auto-builds on push. **No database migration is needed** — it's already done.

## 2. Vercel → int-ai → Settings → Environment Variables
Set these (Production). Values you must supply are marked ⟵.

```
# Frontend (build-time)
VITE_SUPABASE_URL=https://hkdzljeqtmsnwvzeulwe.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_mbSMTswZmFlR58YePk_wEA_v4hH_ml2
VITE_API_URL=

# Backend (serverless)
OPENROUTER_API_KEY=            ⟵ your OpenRouter key (powers "Ask INT")
SUPABASE_URL=https://hkdzljeqtmsnwvzeulwe.supabase.co
DATABASE_URL=                  ⟵ Supabase → Connect → ORMs → Prisma  (pooled, :6543, ?pgbouncer=true)
DIRECT_URL=                    ⟵ same screen (direct connection, :5432)
NODE_ENV=production
```

Everything else in `server/.env.example` (Google/Slack/Stripe/OpenAI/Anthropic/Redis)
is **optional** — the app runs without them.

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
