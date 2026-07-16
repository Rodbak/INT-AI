# INT AI Deployment Guide

## Architecture Note

INT AI is a **Vite + Express monorepo**, not a Next.js app. The frontend (`app/`) is a Vite React app, and the backend (`server/`) is an Express API. All AI provider API keys and secrets live **exclusively on the server**. The client never sees raw secrets and never calls external AI APIs directly.

### Secret storage rules

- **Server-side only:** `server/.env` and `server/.env.local` contain all API keys.
- **Gitignored:** Both files are listed in `server/.gitignore`.
- **No `NEXT_PUBLIC_` prefix:** This project does not use Next.js. The frontend accesses secrets only through authenticated server routes like `/api/chat`.
- **Frontend env vars:** Only non-secret config (e.g., `VITE_API_URL`, `VITE_SUPABASE_URL`) is exposed to the Vite build via `VITE_` prefix.

## Authentication: Supabase

INT AI uses [Supabase Auth](https://supabase.com/docs/guides/auth) for login/register — there is no custom
password system. The Postgres database is also hosted by the same Supabase project (`server/prisma/schema.prisma`
maps the app's `User` model onto Supabase's `profiles` table, which is kept in sync with `auth.users` via a
database trigger — see `server/prisma/migrations/20260715105100_supabase_auth_sync`).

### One-time Supabase project setup

1. The project is `int-ai` (ref `hkdzljeqtmsnwvzeulwe`) at `https://hkdzljeqtmsnwvzeulwe.supabase.co`.
2. **Enable Google sign-in:**
   - In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth 2.0 Client ID
     (Application type: Web application).
   - Add this Authorized redirect URI: `https://hkdzljeqtmsnwvzeulwe.supabase.co/auth/v1/callback`
   - In the Supabase dashboard, go to **Authentication -> Providers -> Google**, enable it, and paste in the
     Client ID and Client Secret from Google Cloud Console.
3. **Get the values needed for env vars** (Supabase dashboard -> Project Settings -> API):
   - Project URL -> `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon` public key -> `VITE_SUPABASE_ANON_KEY`
   - JWT Settings -> JWT Secret -> `SUPABASE_JWT_SECRET`
   - Database -> Connection string -> `DATABASE_URL`

### Current state: real per-request auth is disabled

`server/src/middleware/auth.ts` and `app/src/lib/auth.ts` are both stubbed — every request is attached to
one hardcoded "demo user" rather than a verified Supabase session, and the frontend never actually calls
`supabase.auth.signInWithOAuth(...)`. There is no login gate: anyone who reaches the app uses the same
shared account. This is a known gap, not something this deployment guide papers over — treat wiring up real
per-user Supabase Auth (session handling, a working `/login` route, JWT verification in `authenticate`) as a
follow-up before treating this as production-ready for multiple real users.

In the meantime, the demo user must exist as a real row in Supabase's `auth.users` table, because `profiles`
has a foreign-key constraint against it — without this, creating a conversation (i.e. sending the first chat
message) fails with a foreign key violation.

**One-time setup:**
1. Supabase dashboard -> Authentication -> Users -> **Add user** -> create one user (e.g.
   `demo@yourapp.com`, any password, "Auto Confirm User" checked). Copy its UUID.
2. Set `DEMO_USER_ID` (to that UUID) and `DEMO_USER_EMAIL` (to that email) in your environment — see the
   variable table below. The default `DEMO_USER_ID` in `.env.example` will NOT exist in your database.
3. Run the seed script (see Database Migrations below) — it upserts a matching `profiles` row (via the
   `handle_new_user` trigger you get this for free once the `auth.users` row exists) and joins it to the
   default workspace as owner.

### Granting admin access

The seeded demo user already has `role = 'admin'`. If you later add other real users, promote them via the
Supabase SQL editor:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'you@example.com';
```

## Local Development

1. Clone the repository and install dependencies:
    ```bash
    npm install
    ```

2. Copy the environment templates and fill in the Supabase values from above:
    ```bash
    cp server/.env.example server/.env
    cp app/.env.example app/.env
    ```

3. **Optional:** Create `server/.env.local` for local-only overrides (e.g., different API keys per machine). This file is loaded after `server/.env` and is also gitignored.
    ```bash
    cp server/.env.local.example server/.env.local
    ```

4. Start Redis (via Docker or locally):
    ```bash
    docker compose up redis -d
    ```

5. Apply database migrations and seed reference data (specialists, models, billing plans):
    ```bash
    npm run db:push --workspace=server
    npm run db:seed --workspace=server
    ```

6. Start the development servers:
    ```bash
    npm run dev
    ```

This starts the Express backend on `http://localhost:3001` and the Vite frontend on `http://localhost:5173`.

## Docker Deployment

1. Create a `.env` file in the project root with the required variables (see Environment Variables below).

2. Build and start the full stack:
   ```bash
   docker compose up --build
   ```

3. Run database migrations inside the running container:
   ```bash
   docker compose exec app npx prisma migrate deploy
   ```

4. The application will be available at `http://localhost:3001`.

## Vercel Deployment (frontend + backend, single project) — recommended

The whole app deploys as **one Vercel project**: the frontend builds to static assets as before, and the
Express backend runs as a single Vercel serverless function (`api/index.ts`, which wraps `server/src/app.ts`
directly — no separate host needed).

1. Connect your repository to Vercel with the **Root Directory** left at the repo root (not `app`).
   `vercel.json` at the root already defines the install/build commands and routes `/api/*` requests to
   the serverless function; everything else falls through to the SPA (`app/dist/index.html`).
2. Set these environment variables in the Vercel dashboard (Project Settings -> Environment Variables):

   **Frontend (must have the `VITE_` prefix — baked into the build):**
   - `VITE_SUPABASE_URL` — Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — Supabase anon public key
   - (No `VITE_API_URL` needed — the frontend calls `/api/...` on the same origin.)

   **Backend (read by the serverless function at runtime):**
   - `DATABASE_URL` — **pooled** Supabase connection string, port `6543` (Supabase dashboard -> Connect ->
     Transaction pooler). Serverless functions open a fresh connection per invocation; without pooling you
     will exhaust Postgres's connection limit under any real concurrency.
   - `DIRECT_URL` — **direct** Supabase connection string, port `5432`. Only used by Prisma for running
     migrations (`prisma migrate deploy`), never at request time.
   - `SUPABASE_JWT_SECRET`, `OAUTH_ENCRYPTION_KEY`, `PUBLIC_BASE_URL` (set to your Vercel domain, e.g.
     `https://int-ai-nu.vercel.app`), `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, and any OAuth/Stripe keys you use
     — same variables as the table below.
   - `DEMO_USER_ID` / `DEMO_USER_EMAIL` — see "Current state: real per-request auth is disabled" above.
     **Required** — without a `DEMO_USER_ID` that matches a real `auth.users` row, sending the first chat
     message will fail.
   - `REDIS_URL` — see "Rate limiting on Vercel" below. If unset, rate limiting still works but only
     per-instance (see caveat).
   - `NODE_ENV=production`

3. Create the demo user (Supabase dashboard -> Authentication -> Users -> Add user) and run migrations +
   seed against the database once, from your machine (Vercel doesn't do either automatically):
   ```bash
   DATABASE_URL="<your DIRECT_URL>" npm run prisma:migrate --workspace=server -- deploy
   DATABASE_URL="<your DIRECT_URL>" DEMO_USER_ID="<uuid from step above>" DEMO_USER_EMAIL="<that email>" \
     npm run db:seed --workspace=server
   ```
4. Push/redeploy. Vercel runs `npm install` at the repo root (installs both workspaces and runs
   `prisma generate` via `server`'s `postinstall` script), then `npm run build --workspace=app`, then bundles
   `api/index.ts` as the serverless function.

### Rate limiting on Vercel

`server/src/middleware/rateLimit.ts` already falls back to an in-memory limiter when Redis isn't configured
or reachable, so the app works without `REDIS_URL`. The caveat: each serverless instance has its own memory,
so the limit is enforced per-instance rather than globally across all concurrent invocations. For a real
global rate limit, point `REDIS_URL` at a managed Redis reachable over the public internet (e.g. Upstash's
free tier, which is built for serverless — a local/Docker Redis instance is not reachable from Vercel).

### Known limitation: file uploads

`server/src/routes/uploads.ts` writes to `/tmp/uploads` in production. On Vercel, `/tmp` is ephemeral and
**not shared** across function invocations or instances — an uploaded file may not be retrievable by a later
request. This works as-is on the Docker/self-host path (persistent disk) but not reliably on Vercel serverless.
Fixing this for Vercel requires switching upload storage to Supabase Storage or S3, which is a follow-up, not
part of this conversion.

## Render / Railway Backend Deployment (alternative)

If you'd rather run the backend as a long-lived container instead of Vercel serverless functions (e.g. to
avoid the connection-pooling and ephemeral-storage caveats above), deploy `server/` to Render, Railway, or
similar, and keep `vercel.json` frontend-only (point `VITE_API_URL` at the container's URL instead of using
same-origin `/api` calls). This is the same shape as the Docker deployment above, just hosted rather than
self-run.

### Required environment variables:
- `DATABASE_URL` — Supabase Postgres connection string (direct connection is fine here — long-lived process, no pooling concern)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_JWT_SECRET` — used to verify Supabase-issued access tokens
- `OAUTH_ENCRYPTION_KEY` — 32+ character key for encrypting OAuth tokens
- `PUBLIC_BASE_URL` — public URL of this backend (e.g. `https://api.yourapp.com`)
- `REDIS_URL` — Redis connection string
- `ANTHROPIC_API_KEY` — Anthropic API key
- `ANTHROPIC_MODEL` — Model name (default: `claude-sonnet-5`)
- `NODE_ENV=production`
- `PORT=3001`

### Build & Start commands:
- **Build command:** `npm install && npm run build --workspace=server`
- **Start command:** `npm run start --workspace=server`

### Static assets:
In production, the server serves the built frontend from `app/dist`. Ensure the frontend build output is available to the backend process, or deploy the frontend and backend as separate services and configure `VITE_API_URL` to point to the backend.

## OAuth Connections

INT AI supports OAuth 2.0 connections to external services. To enable them:

1. Create OAuth apps in each provider's developer console:
   - **Google:** https://console.cloud.google.com/apis/credentials
   - **Microsoft:** https://portal.azure.com/ -> App registrations
   - **Slack:** https://api.slack.com/apps
   - **GitHub:** https://github.com/settings/developers

2. Set the redirect URI to: `{PUBLIC_BASE_URL}/api/connections/oauth/callback/{provider}`

3. Add the client IDs and secrets to `server/.env`:
   - `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
   - `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET`
   - `SLACK_OAUTH_CLIENT_ID` / `SLACK_OAUTH_CLIENT_SECRET`
   - `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`

4. Generate a strong `OAUTH_ENCRYPTION_KEY` (32+ characters) for token encryption.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Supabase Postgres connection string (pooled, port 6543, when deploying to Vercel serverless) |
| `DIRECT_URL` | No (Yes for Vercel migrations) | — | Direct (non-pooled) Supabase connection string, port 5432 — used by Prisma for migrations only |
| `SUPABASE_URL` | No | — | Supabase project URL (used server-side for reference) |
| `SUPABASE_JWT_SECRET` | Yes | — | Verifies Supabase-issued access tokens |
| `DEMO_USER_ID` | Yes | `00000000-0000-0000-0000-000000000000` | UUID of a real `auth.users` row every request is attached to while real per-request auth is disabled — see "Current state" above |
| `DEMO_USER_EMAIL` | No | `demo@example.com` | Email of that same user |
| `REDIS_URL` | Yes | — | Redis connection string |
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-5` | Model identifier |
| `OPENAI_API_KEY` | No | — | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o` | Model identifier |
| `OPENROUTER_API_KEY` | No | — | OpenRouter API key |
| `GOOGLE_AI_API_KEY` | No | — | Google AI API key |
| `GOOGLE_MODEL` | No | `gemini-2.0-flash` | Model identifier |
| `STRIPE_PRICE_ID_MAP` | No | `{}` | JSON mapping of plan IDs to Stripe price IDs |
| `PUBLIC_BASE_URL` | Yes | `http://localhost:3001` | Public URL of the backend |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Node environment |
| `VITE_API_URL` | Yes (frontend) | — | Backend API URL for frontend |
| `VITE_SUPABASE_URL` | Yes (frontend) | — | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (frontend) | — | Supabase anon public key |

### `.env.local`

For local development, you may create `server/.env.local` to override values from `server/.env` without editing the shared file. It is also gitignored and is loaded after `.env`.

## Database Migrations

The project uses Prisma as the ORM.

- **Generate client:** `npm run prisma:generate --workspace=server`
- **Apply migrations:** `npm run prisma:migrate --workspace=server`
- **Push schema (dev):** `npm run prisma:push --workspace=server`
- **Seed data:** `npm run db:seed --workspace=server`

The Prisma schema is located at `server/prisma/schema.prisma`. The `supabase_auth_sync` migration is
Supabase-specific (it references the `auth` schema) and can only be applied to a real Supabase project, not a
plain local Postgres instance.
