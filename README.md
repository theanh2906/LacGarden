# Coffee POS

Fullstack Next.js coffee shop POS for Lac Garden, backed by PostgreSQL through Prisma.

## Current Shape

- `apps/web`: Next.js App Router, TypeScript, SCSS.
- `src/app`: POS pages and API route handlers.
- `src/components/pos`: interactive POS UI.
- `src/server`: lazy Prisma-backed business services for POS and inventory.
- `apps/web/prisma/schema.prisma`: PostgreSQL schema mapped to the live SQL Connect / Cloud SQL database.

The POS, inventory, order queue, and reports read and write real database data.

## Local Development

Create `apps/web/.env` with a PostgreSQL connection string:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public&sslmode=require"
```

Then run:

```bash
pnpm install
pnpm --filter @coffee-pos/web db:generate
pnpm --filter @coffee-pos/web db:seed
pnpm dev
```

Open:

```txt
http://localhost:3000
```

## API Endpoints

```txt
GET   /api/menu
GET   /api/orders
POST  /api/orders
POST  /api/orders/checkout
POST  /api/orders/:id/payments
PATCH /api/orders/:id/status
GET   /api/bar
GET   /api/reports/sales
```

Inventory endpoints live under:

```txt
/api/inventory/*
```

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

## Implementation Notes

- Money is represented as integer VND.
- Database and service clients are initialized lazily inside server helpers.
- Until auth/PIN login exists, order and payment writes use the seeded `system-cashier` user.
- The seed command is idempotent for the starter menu, system user, and inventory items.
