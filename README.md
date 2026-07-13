# Coffee POS

Fullstack Next.js coffee shop POS for Lac Garden, backed by PostgreSQL through Prisma.

## Current Shape

- `apps/web`: Next.js App Router, TypeScript, SCSS.
- `src/app`: POS pages and API route handlers.
- `src/components/pos`: interactive POS UI.
- `src/server`: lazy Prisma-backed business services for POS and inventory.
- `apps/web/prisma/schema.prisma`: PostgreSQL schema mapped to the live SQL Connect / Cloud SQL database.

The POS, inventory, order queue, reports, and Dorm module read and write real database data.

## Dorm module

Open `/dorm` as an owner or manager to manage dorm sites, rooms/beds, tenants, leases, monthly invoices, and rent payments. The Vercel build synchronizes the additive Prisma schema before deployment.

## Local Development

Create `apps/web/.env` with a PostgreSQL connection string:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public&sslmode=require"
COFFEE_POS_SESSION_SECRET="replace-with-a-long-random-local-secret"
COFFEE_POS_OWNER_USERNAME="admin"
COFFEE_POS_OWNER_PIN="admin"
COFFEE_POS_QR_ENABLED=false
COFFEE_POS_QR_BANK_BIN="970436"
COFFEE_POS_QR_BANK_NAME="Vietcombank"
COFFEE_POS_QR_ACCOUNT_NUMBER="replace-with-account-number"
COFFEE_POS_QR_ACCOUNT_NAME="LAC GARDEN COFFEE"
COFFEE_POS_QR_TEMPLATE="compact2"
COFFEE_POS_QR_EXPIRY_MINUTES=10
COFFEE_POS_TAX_RATE_PERCENT=0
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

After seeding, the local owner login defaults to `admin` / `admin` unless `COFFEE_POS_OWNER_USERNAME` and `COFFEE_POS_OWNER_PIN` are changed before the first seed.

## API Endpoints

```txt
GET   /api/menu
GET   /api/orders
POST  /api/orders
POST  /api/orders/checkout
POST  /api/orders/checkout/qr
POST  /api/orders/:id/payments
PATCH /api/orders/:id/status
POST  /api/payments/:id/confirm
GET   /api/bar
GET   /api/reports/sales
GET   /api/reports/analytics
GET   /api/reports/export?format=csv
GET   /api/reports/export?format=xlsx
GET   /api/reports/export?format=pdf
GET   /api/payroll
POST  /api/payroll
POST  /api/payroll/review
POST  /api/payroll/adjustments
GET   /api/payroll/export?format=csv
GET   /api/payroll/export?format=xlsx
POST  /api/auth/login
POST  /api/auth/logout
GET   /api/auth/session
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

## Deployment Readiness

See `docs/DEPLOYMENT.md` for Vercel env verification, database migration workflow, smoke tests, screenshot capture, and staging/production release notes.
See `docs/QA.md` for the latest responsive review notes and screenshot inventory.

## Implementation Notes

- Money is represented as integer VND.
- Database and service clients are initialized lazily inside server helpers.
- Staff auth uses signed httpOnly cookies and the existing `users.pin_hash` field.
- Order, payment, inventory upload, import, and stock movement writes attach the active staff user when available.
- Bank-transfer QR checkout is greyed out as Coming soon by default. Set `COFFEE_POS_QR_ENABLED=true` with bank config when the payment integration is ready.
- Sales analytics live at `/reports` and export CSV, Excel, and a simple built-in PDF summary without adding a heavy PDF dependency.
- Tax reporting uses `COFFEE_POS_TAX_RATE_PERCENT`; the default is `0` so local deployments do not assume a jurisdiction-specific tax rate.
- Payroll lives at `/payroll`, uses approved timesheets only, supports bonus/deduction adjustments, and exports CSV/Excel for accounting review.
- The seed command is idempotent for the starter menu, system user, owner user, and inventory items.
