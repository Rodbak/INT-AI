# INT AI Workspace

A React + Vite + TypeScript frontend for the INT AI Workspace, backed by a minimal Express server that proxies chat messages to the Claude API.

## Local development

Two terminals:

```bash
# Terminal 1 — backend
cd server
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY
npm run dev
```

```bash
# Terminal 2 — frontend
cd app
npm install
npm run dev
```

Open the URL Vite prints (defaults to `http://localhost:5173`). The Vite dev server proxies `/api/*` requests to the backend on port 3001.

Sending a message in the composer appends it to the thread, calls the backend, and shows the real Claude reply (or a clear error if the API key is missing/invalid).

## Production

```bash
# Build the frontend
cd app
npm install
npm run build

# Run the server, which serves the built frontend and the /api routes
cd ../server
npm install
ANTHROPIC_API_KEY=your-key NODE_ENV=production npm start
```

The server listens on `PORT` (default `3001`) and serves the app at `/`.

## Configuration

Set these in `server/.env` (see `server/.env.example`):

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | — | Server exits at startup if this is unset |
| `ANTHROPIC_MODEL` | No | `claude-opus-4-8` | Any current Claude model ID |
| `PORT` | No | `3001` | |
