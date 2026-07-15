# INT AI Deployment Guide

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

### Granting admin access

`server/prisma/seed.ts` no longer creates a demo user (Supabase owns user creation now). To make yourself an
admin: sign in once through the app via Google, then run in the Supabase SQL editor:

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

3. Start Redis (via Docker or locally):
   ```bash
   docker compose up redis -d
   ```

4. Apply database migrations and seed reference data (specialists, models, billing plans):
   ```bash
   npm run db:push --workspace=server
   npm run db:seed --workspace=server
   ```

5. Start the development servers:
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

## Vercel Frontend Deployment

The frontend lives in `app/` and is configured for Vercel deployment.

1. Connect your repository to Vercel.
2. Set the **Root Directory** to `app`.
3. Vercel will automatically detect the Vite framework and run `npm run build`.
4. Set the following environment variables in the Vercel dashboard:
   - `VITE_API_URL` — URL of your deployed backend (e.g. `https://int-ai-api.onrender.com`)
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — from the Supabase project settings above

The `vercel.json` at the project root is configured for frontend-only deployment. The backend must be deployed separately.

## Render / Railway Backend Deployment

Deploy the Express backend (`server/`) to Render, Railway, or a similar container host.

### Required environment variables:
- `DATABASE_URL` — Supabase Postgres connection string
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_JWT_SECRET` — used to verify Supabase-issued access tokens
- `REDIS_URL` — Redis connection string
- `ANTHROPIC_API_KEY` — Anthropic API key
- `ANTHROPIC_MODEL` — Model name (default: `claude-sonnet-4-5-20250929`)
- `NODE_ENV=production`
- `PORT=3001`

### Build & Start commands:
- **Build command:** `npm install && npm run build --workspace=server`
- **Start command:** `npm run start --workspace=server`

### Static assets:
In production, the server serves the built frontend from `app/dist`. Ensure the frontend build output is available to the backend process, or deploy the frontend and backend as separate services and configure `VITE_API_URL` to point to the backend.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Supabase Postgres connection string |
| `SUPABASE_URL` | No | — | Supabase project URL (used server-side for reference) |
| `SUPABASE_JWT_SECRET` | Yes | — | Verifies Supabase-issued access tokens |
| `REDIS_URL` | Yes | — | Redis connection string |
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-5-20250929` | Model identifier |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Node environment |
| `VITE_API_URL` | Yes (frontend) | — | Backend API URL for frontend |
| `VITE_SUPABASE_URL` | Yes (frontend) | — | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (frontend) | — | Supabase anon public key |

## Database Migrations

The project uses Prisma as the ORM.

- **Generate client:** `npm run prisma:generate --workspace=server`
- **Apply migrations:** `npm run prisma:migrate --workspace=server`
- **Push schema (dev):** `npm run prisma:push --workspace=server`
- **Seed data:** `npm run db:seed --workspace=server`

The Prisma schema is located at `server/prisma/schema.prisma`. The `supabase_auth_sync` migration is
Supabase-specific (it references the `auth` schema) and can only be applied to a real Supabase project, not a
plain local Postgres instance.
