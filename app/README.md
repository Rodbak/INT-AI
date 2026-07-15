# INT AI Workspace (frontend)

A React 19 + Vite + TypeScript frontend for the INT AI Workspace, backed by an Express + Prisma/PostgreSQL API server with multi-provider AI routing (Anthropic, OpenAI, Google).

See the [root README](../README.md) and [DEPLOYMENT.md](../DEPLOYMENT.md) for full architecture and deployment details.

## Local development

From the repository root:

```bash
npm install
cp server/.env.example server/.env
cp app/.env.example app/.env
# fill in Supabase values in both .env files (see root DEPLOYMENT.md) and at least one AI provider key
docker compose up redis -d
npm run db:push --workspace=server
npm run db:seed --workspace=server
npm run dev
```

`npm run dev` starts both the Express backend (`http://localhost:3001`) and the Vite frontend (`http://localhost:5173`) via `concurrently`. The Vite dev server proxies `/api/*` requests to the backend.

To work on the frontend alone (with the backend already running elsewhere):

```bash
cd app
npm install
npm run dev
```

## Production

```bash
# Build the frontend
cd app
npm install
npm run build

# Build and run the server, which serves the built frontend and the /api routes
cd ../server
npm install
npm run build
npm start
```

The server listens on `PORT` (default `3001`) and serves the app at `/`.

## Configuration

The frontend reads `VITE_API_URL` (backend base URL) and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (for Google
sign-in) at build time — see `app/.env.example`. All backend configuration (`DATABASE_URL`, `SUPABASE_JWT_SECRET`,
AI provider keys, `REDIS_URL`, etc.) lives in `server/.env` — see `server/.env.example` and the root
[DEPLOYMENT.md](../DEPLOYMENT.md) for the full list.
