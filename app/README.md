# INT AI Workspace (frontend)

A React 19 + Vite + TypeScript frontend for the INT AI Workspace, backed by an Express + Prisma/PostgreSQL API server with multi-provider AI routing (Anthropic, OpenAI, Google).

See the [root README](../README.md) and [DEPLOYMENT.md](../DEPLOYMENT.md) for full architecture and deployment details.

## Local development

From the repository root:

```bash
npm install
cp server/.env.example server/.env
# edit server/.env: set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, and at least one AI provider key
docker compose up postgres redis -d
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

The frontend reads `VITE_API_URL` at build time (the backend API base URL). All other configuration (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, AI provider keys, `REDIS_URL`, etc.) lives in `server/.env` — see `server/.env.example` and the root [DEPLOYMENT.md](../DEPLOYMENT.md) for the full list.
