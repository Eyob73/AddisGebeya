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
CLOUDINARY_CLOUD_NAME=Root
CLOUDINARY_API_KEY=368673597326217
CLOUDINARY_API_SECRET=7T3NWgGXFnDkpavuTzZoKqO0vu4
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

## API Health-Check & Documentation Endpoints

Verify that the backend and database connection are operational:

- **Health Status:** `GET http://localhost:5000/api/v1/health`
- **Swagger UI Interactive Documentation:** `GET http://localhost:5000/api/v1/docs` or `http://localhost:5000/docs`
- **OpenAPI 3.0 JSON Specification:** `GET http://localhost:5000/api/v1/docs.json`

Example Health Response:

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
    "timestamp": "2026-11-23T18:35:00.000Z",
    "database": {
      "status": "connected",
      "latencyMs": 3
    }
  },
  "timestamp": "2026-11-23T18:35:00.000Z"
}
```

## Security & Payment Testing

Execute the comprehensive automated test suites against the database:

```bash
# 18 end-to-end authentication, authorization, and RBAC security tests
pnpm --filter @addisgebeya/api test:e2e

# 14 end-to-end Cloudinary image upload, replacement, deletion, and validation tests
pnpm --filter @addisgebeya/api test:cloudinary

# 17 end-to-end profile, avatar, password, address, order history & account deletion tests
pnpm --filter @addisgebeya/api exec tsx test-profile-e2e.ts

# 14 end-to-end Cheki API payment verification, anti-fraud, concurrency & admin review tests
pnpm --filter @addisgebeya/api test:payments

# Full integration flow (catalog, persistent cart/wishlist, transactional order & stock decrement, Telebirr payment, admin dashboard)
pnpm --filter @addisgebeya/api exec tsx test-flow.ts
```

## Customer Profile & Account Management

The platform includes a dedicated, database-driven customer account management portal:
- **Profile Dashboard (`/account`):** Live customer overview, account status badges, lifetime order count, recent orders preview, default delivery destination, and security shortcuts.
- **Personal Information (`/account/profile`):** First/last name, email change with collision verification, phone number, birthdate, preferred EU shoe size, and sub-city.
- **Avatar Management (`POST /api/v1/auth/avatar`):** Image upload, Unsplash preset avatar picker, and instant state synchronization across the navigation bar and profile header.
- **Change Password (`/account/security`):** Secure current-password verification, strong password requirements (min 8 chars), real-time password strength meter, password reuse prevention, and immediate invalidation of prior refresh tokens.
- **Address Management (`/account/addresses`):** Full CRUD for multiple delivery destinations with labels (`Home`, `Office`, `Other`), Addis Ababa sub-cities, Woreda, street address, delivery landmark/instructions, and single-default address enforcement. Order snapshots preserve delivery history.
- **Account Settings (`/account/settings`):** Email verification badges, multi-device session management ("Logout this device" vs "Logout all devices" revoking all refresh tokens), and Danger Zone soft-deletion (`isActive: false`) with password confirmation.
- **Order History (`/account/orders`):** Order list with status badges, pagination, item counts, ETB pricing, and detailed order receipt inspection with cross-customer ownership isolation.

## Ethiopian Payment Gateway Architecture

The platform provides real-time bank & wallet verification via the **Cheki API** alongside Cash on Delivery (COD). See [docs/CHEKI_PAYMENT_INTEGRATION.md](docs/CHEKI_PAYMENT_INTEGRATION.md) for the complete architecture, endpoints, and verification rules.
- **Cheki Live Verification (`/api/payment/verify`, `/api/payment/providers`, `/api/payment/status/:orderId`):** Backend-proxied receipt validation for CBE, Telebirr, Bank of Abyssinia, Dashen, Awash, CBE Birr, M-Pesa, Siinqee, Wegagen, Bunna, ZamZam, and eBirr.
- **Admin Payment Console (`/admin/payments`, `/api/admin/payments`, `/api/admin/payment-providers`):** Inspect flagged transactions, review audit logs, perform reason-logged manual approvals/rejections, and configure receiving bank/wallet accounts.
- **Cash on Delivery (COD):** Bole Hub doorstep try-on with cash or domestic POS on delivery.

## Cloudinary Media & Image Storage Architecture

Centralized, secure media storage using official Cloudinary SDK with binary content validation and optimized responsive delivery:

### Media Folders
- `addisgebeya/products/` — Product hero and perspective photography
- `addisgebeya/categories/` — Category banners and covers
- `addisgebeya/profiles/` — Customer and staff profile avatars
- `addisgebeya/banners/` — Promotional and promotional hero slides

### Validation & Limits
- Allowed formats: **JPEG**, **JPG**, **PNG**, **WebP**
- Content validation: Binary magic bytes inspection (preventing file extension spoofing)
- File size limit: **5 MB** per image
- Product limit: **8 images** per shoe model
- Authorization: Restricted to authenticated **ADMIN** users

### Image REST Endpoints
| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/products/:id/images` | Upload single or multiple images (`multipart/form-data`) |
| `GET` | `/api/products/:id/images` | List all images for product ordered by primary & displayOrder |
| `PUT` | `/api/products/:id/images/:imageId` | Replace an existing image asset with a new upload |
| `DELETE` | `/api/products/:id/images/:imageId` | Delete image from Cloudinary & DB (promotes new primary if needed) |
| `PATCH` | `/api/products/:id/images/:imageId/primary` | Designate an image as the product hero/primary |
| `PUT` | `/api/products/:id/images/reorder` | Batch reorder image positions |

### On-the-Fly Dynamic Delivery Transformations
- **Product Cards & Catalog Grid:** `500x500` fill (`w_500,h_500,c_fill,q_auto,f_auto`)
- **Product Detail Gallery Hero & Zoom:** `1000x1000` fill (`w_1000,h_1000,c_fill,q_auto,f_auto`)
- **Thumbnails (Cart, Checkout, Gallery Bar):** `150x150` fill (`w_150,h_150,c_fill,q_auto,f_auto`)
- **Error Fallback:** Automatic client fallback (`DEFAULT_FALLBACK_IMAGE`) on load failure


