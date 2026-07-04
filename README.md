# Coffee POS

Local-first coffee shop POS demo, now structured as a fullstack Next.js app.

## Current Shape

- `apps/web`: Next.js App Router, TypeScript, SCSS.
- `src/app`: pages and mock API route handlers.
- `src/components`: interactive POS demo UI.
- `src/data`: mock menu, bar queue, and orders.
- `src/server/db.ts`: lazy Prisma client getter for later backend integration.
- `apps/web/prisma/schema.prisma`: database schema foundation for the real POS backend.

The UI currently runs fully on mock data so product/demo review is not blocked by database or auth integration.

## Local Development

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Open:

```txt
http://localhost:3000
```

Mock API endpoints:

```txt
GET  /api/demo/menu
GET  /api/demo/orders
POST /api/demo/orders
GET  /api/demo/bar
```

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Open:

```txt
http://localhost:3000
```

PostgreSQL is included in Compose for future backend work, but the current demo UI does not require it.

## Implementation Notes

- Frontend is demo-first and intentionally uses local state plus mock data.
- Money is represented as integer VND.
- Backend integration should replace `src/data/mock-pos.ts` and `/api/demo/*` route handlers incrementally.
- Database/service clients should be initialized lazily inside server helpers, not at module scope.

## Suggested Next Tasks

1. Add real auth/session route handlers.
2. Replace mock menu/orders with Prisma-backed services.
3. Add menu management screens.
4. Add receipt/bar-ticket printable views.
5. Add reports screen with mock data, then DB aggregation.
