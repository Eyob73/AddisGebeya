# AddisGebeya E-commerce Platform

AddisGebeya is a modern, full-stack e-commerce platform architected as a TypeScript monorepo with independently deployable frontend (`Next.js`) and backend (`Express.js`) applications, shared internal packages, and a PostgreSQL + Prisma database foundation.

## Technology Stack

### Frontend (`apps/web`)

- **Framework:** Next.js (App Router) & React
- **Language:** TypeScript (strict mode)
- **Styling & UI:** Tailwind CSS v4, shadcn/ui, Lucide React
- **State & Data Fetching:** TanStack Query (server state), Zustand (client UI state)
- **Forms & Validation:** React Hook Form, Zod

### Backend (`apps/api`)

- **Runtime & Framework:** Node.js, Express.js (ES Modules)
- **Language:** TypeScript (strict mode)
- **Database & ORM:** PostgreSQL, Prisma ORM
- **Validation & Security:** Zod, Helmet, CORS, bcrypt, JSON Web Tokens (JWT)
- **Logging:** Morgan

### Tooling & Workspace

- **Monorepo:** pnpm workspaces
- **Code Quality:** ESLint, Prettier, EditorConfig
- **Infrastructure:** Docker Compose (optional local PostgreSQL)

## Architecture & Folder Structure

```text
AddisGebeya/
├── apps/
│   ├── web/                        # Next.js App Router frontend
│   │   └── src/
│   │       ├── app/                # Route groups: (store), (auth), (dashboard)
│   │       ├── components/         # ui/, shared/, layout/, providers/
│   │       ├── features/           # Feature-scoped modules (upcoming phases)
│   │       ├── hooks/              # Reusable React & query hooks
│   │       ├── lib/                # API client, env config, cn() utility
│   │       ├── services/           # HTTP API service wrappers
│   │       ├── stores/             # Zustand client stores
│   │       ├── types/              # Frontend type exports
│   │       └── utils/              # Pure utility helpers
│   └── api/                        # Express.js REST API backend
│       ├── prisma/                 # Prisma schema & seed foundation
│       └── src/
│           ├── config/             # Environment, CORS, Prisma client
│           ├── middlewares/        # Validation, 404, centralized error handler
│           ├── modules/            # Domain modules (routes/controller/service/repository/validation/types/mapper)
│           ├── routes/             # API versioned router (/api/v1)
│           ├── types/              # API-specific TypeScript types
│           ├── utils/              # AppError, responses, logger, JWT & bcrypt utilities
│           ├── app.ts              # Express app factory
│           └── server.ts           # HTTP server bootstrap & graceful shutdown
├── packages/
│   ├── config/                     # Shared strict TypeScript configurations
│   ├── shared/                     # Shared constants & HTTP status codes
│   ├── types/                      # Shared API & DTO TypeScript interfaces
│   └── validation/                 # Shared Zod validation schemas
├── infrastructure/
│   ├── docker/                     # PostgreSQL Docker initialization SQL
│   └── scripts/                    # Local environment bootstrap scripts
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

### Backend Module Convention

Every future domain module inside `apps/api/src/modules/<domain>/` follows strict separation of concerns:

- `<domain>.routes.ts` — Route definitions & middleware wiring only
- `<domain>.controller.ts` — HTTP request/response translation (no DB queries or business logic)
- `<domain>.service.ts` — Core business logic & orchestration
- `<domain>.repository.ts` — Prisma/database access layer
- `<domain>.validation.ts` — Zod request schemas
- `<domain>.types.ts` — Module types and DTO contracts
- `<domain>.mapper.ts` — Entity-to-DTO transformations

## Prerequisites

- **Node.js:** `>= 20.0.0` (tested on Node 24)
- **pnpm:** `>= 9.0.0`
- **PostgreSQL:** `>= 15` (local installation or Docker)
- **Git**

## Installation

```bash
git clone <repository-url>
cd AddisGebeya
pnpm install
```

Build shared workspace packages and generate the Prisma client:

```bash
pnpm build:packages
pnpm db:generate
```

## Environment Configuration

Never commit `.env` or `.env.local` files to Git. Copy the example templates and provide your local values:

### Frontend (`apps/web/.env.local`)

Copy `apps/web/.env.example`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

### Backend (`apps/api/.env`)

Copy `apps/api/.env.example`:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
DATABASE_URL="postgresql://addisgebeya:addisgebeya_dev@localhost:5432/addisgebeya_dev?schema=public"
JWT_ACCESS_SECRET="replace-with-a-strong-random-secret"
JWT_REFRESH_SECRET="replace-with-a-strong-random-secret"
```

## Development Commands

Run commands from the repository root:

| Command             | Description                                                                    |
| ------------------- | ------------------------------------------------------------------------------ |
| `pnpm dev:web`      | Start Next.js frontend in development mode (`http://localhost:3000`)           |
| `pnpm dev:api`      | Start Express.js API in watch mode (`http://localhost:5000`)                   |
| `pnpm build:web`    | Build shared packages and Next.js production bundle                            |
| `pnpm build:api`    | Build shared packages and compile Express.js TypeScript to `dist/`             |
| `pnpm lint`         | Run ESLint across all workspace applications                                   |
| `pnpm typecheck`    | Build shared packages and run strict TypeScript checking across all workspaces |
| `pnpm format`       | Format all project files with Prettier                                         |
| `pnpm format:check` | Verify formatting with Prettier                                                |

## Database Setup

### Option 1: Docker Compose

```bash
docker compose up -d postgres
```

This starts PostgreSQL on port `5432` with default credentials matching:

```text
postgresql://addisgebeya:addisgebeya_dev@localhost:5432/addisgebeya_dev?schema=public
```

### Option 2: Local PostgreSQL

Create a database (for example `addisgebeya_dev`) and configure `DATABASE_URL` in `apps/api/.env`.

### Prisma Commands

```bash
pnpm db:generate   # Generate Prisma Client
pnpm db:migrate    # Run development migrations (once models are added)
pnpm db:seed       # Run database seed foundation
pnpm db:studio     # Open Prisma Studio
```

## API Health-Check Endpoint

Verify that the backend and database connection are operational:

```http
GET http://localhost:5000/api/v1/health
```

Example response:

```json
{
  "success": true,
  "message": "Service health status retrieved",
  "data": {
    "status": "ok",
    "service": "AddisGebeya API",
    "version": "v1",
    "environment": "development",
    "uptimeSeconds": 12,
    "timestamp": "2026-11-18T08:35:00.000Z",
    "database": {
      "status": "connected",
      "latencyMs": 3
    }
  },
  "timestamp": "2026-11-18T08:35:00.000Z"
}
```
