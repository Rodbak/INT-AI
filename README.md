# INT AI

**INT AI** is an intelligent workspace that connects multiple AI providers (Anthropic, OpenAI, Google) with a unified interface for document-aware conversations, specialist routing, and team collaboration.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Vercel    │────▶│  Express     │────▶│ PostgreSQL  │
│  (Frontend) │     │  (Backend)   │     │   (Prisma)  │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐
                    │    Redis     │
                    │  (Sessions,  │
                    │   Rate Limit)│
                    └──────────────┘
                           │
                    ┌──────▼───────┐
                    │   AI APIs    │
                    │ Anthropic /  │
                    │ OpenAI /     │
                    │  Google      │
                    └──────────────┘
```

The frontend is a React + Vite application served statically by the backend in production. The backend is an Express server with Prisma ORM, Redis caching, and provider-agnostic AI routing.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, CSS Modules
- **Backend:** Express 5, TypeScript, tsx
- **Database:** PostgreSQL 15 via Prisma
- **Cache:** Redis 7
- **AI:** Anthropic Claude, OpenAI, Google Gemini
- **Linting:** oxlint
- **Containerization:** Docker, Docker Compose

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Anthropic API key

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp server/.env.example server/.env

# Start databases
docker compose up postgres redis -d

# Run migrations and seed data
npm run db:push --workspace=server
npm run db:seed --workspace=server

# Start development servers
npm run dev
```

Open `http://localhost:5173` in your browser.

## Project Structure

```
INT-AI/
├── app/                    # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components (Layout, Sidebar, Composer, Thread, ...)
│   │   ├── pages/          # Route-level pages (Login, History, Specialists, Billing, ...)
│   │   ├── hooks/          # useAuth, useConversations, useStreamingChat
│   │   ├── lib/            # api.ts (axios client), auth.ts, store.ts (zustand)
│   │   ├── data/           # Workspace data models
│   │   ├── types/          # Shared TypeScript types
│   │   ├── App.tsx         # Root component
│   │   └── main.tsx        # Entry point
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # auth, conversations, chat, models, specialists, teams, ...
│   │   ├── providers/      # AI provider clients (Anthropic, OpenAI, Google)
│   │   ├── routing/        # Task-to-model routing logic
│   │   ├── middleware/     # Auth, logging, rate limiting
│   │   ├── utils/          # Cost tracking, Redis, streaming helpers
│   │   ├── env.ts          # Environment validation (Zod)
│   │   ├── db.ts           # Database client
│   │   └── index.ts        # Server entry point (compiles to dist/index.js)
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   └── seed.ts         # Database seeder
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
├── docker-compose.yml      # Full-stack Docker setup
├── Dockerfile              # Multi-stage production image
├── vercel.json             # Vercel frontend config
└── package.json            # Root workspace config
```

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-change`
3. Make your changes and ensure tests/lint pass.
4. Submit a pull request.

Please follow the existing code style and ensure all TypeScript checks pass before submitting.

## License

MIT — see the [LICENSE](LICENSE) file for details.
