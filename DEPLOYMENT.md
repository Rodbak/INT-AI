# INT AI Deployment Guide

## Local Development

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Copy the server environment template:
   ```bash
   cp server/.env.example server/.env
   ```

3. Start PostgreSQL and Redis (via Docker or locally):
   ```bash
   docker compose up postgres redis -d
   ```

4. Run database migrations:
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

The `vercel.json` at the project root is configured for frontend-only deployment. The backend must be deployed separately.

## Render / Railway Backend Deployment

Deploy the Express backend (`server/`) to Render, Railway, or a similar container host.

### Required environment variables:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `ANTHROPIC_API_KEY` — Anthropic API key
- `ANTHROPIC_MODEL` — Model name (default: `claude-sonnet-4-5-20250929`)
- `JWT_SECRET` — Secret for JWT signing
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
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-5-20250929` | Model identifier |
| `JWT_SECRET` | Yes | — | JWT signing secret |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Node environment |
| `VITE_API_URL` | Yes (frontend) | — | Backend API URL for frontend |

## Database Migrations

The project uses Prisma as the ORM.

- **Generate client:** `npm run prisma:generate --workspace=server`
- **Apply migrations:** `npm run prisma:migrate --workspace=server`
- **Push schema (dev):** `npm run prisma:push --workspace=server`
- **Seed data:** `npm run db:seed --workspace=server`

The Prisma schema is located at `server/prisma/schema.prisma`.
