# INT AI

INT AI is a multi-provider AI platform that routes requests to the best AI models based on task type. It supports Anthropic, OpenAI, Google, and OpenRouter providers with automatic model selection, team-based workflows, knowledge management, and usage analytics.

## Architecture

```
app/          - Vite + React frontend
server/       - Express.js backend API
```

- **Frontend**: React 19, React Router, Zustand, React Query
- **Backend**: Express 5, Prisma ORM, Redis, Pino logging
- **Auth**: Supabase Auth (Google OAuth)
- **AI Providers**: Anthropic, OpenAI, Google AI, OpenRouter
- **Database**: PostgreSQL (Supabase)
- **Cache/Queue**: Redis + BullMQ

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL (Supabase recommended)
- Redis
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment files
cp server/.env.example server/.env
cp app/.env.example app/.env

# Start Redis
docker compose up redis -d

# Apply database schema
npm run db:push --workspace=server

# Seed reference data
npm run db:seed --workspace=server

# Start development servers
npm run dev
```

This starts the Express backend on `http://localhost:3001` and the Vite frontend on `http://localhost:5173`.

## Environment Variables

See `DEPLOYMENT.md` for the full list of required environment variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` / `SUPABASE_JWT_SECRET` - Supabase Auth
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` / `GOOGLE_AI_API_KEY` - AI providers
- `OAUTH_ENCRYPTION_KEY` - OAuth token encryption
- `STRIPE_SECRET_KEY` - Stripe payments

## Features

- **Multi-provider AI routing**: Automatically selects the best model for the task
- **OAuth connections**: Connect Google, Microsoft, Slack, GitHub
- **Knowledge base**: Upload and query documents with RAG
- **Teams & Specialists**: Build AI teams with specialized agents
- **Automations**: Workflow automation with triggers
- **Usage analytics**: Track token usage and costs
- **Billing**: Subscription management with Stripe
- **Admin dashboard**: User and model management

## Scripts

```bash
npm run dev              # Start both frontend and backend
npm run build            # Build both workspaces
npm run lint             # Lint both workspaces
npm run db:push --workspace=server   # Push schema changes
npm run db:seed --workspace=server   # Seed reference data
```

## License

MIT
