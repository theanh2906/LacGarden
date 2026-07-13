# Deployment Operations

This app is a local-first Next.js POS backed by PostgreSQL through Prisma. Use this checklist for staging and production readiness.

## Required Environment Variables

Set secrets in Vercel Project Settings or with `vercel env add`. Do not commit real values.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string for Prisma. Use separate staging and production databases. |
| `COFFEE_POS_SESSION_SECRET` | Yes | Long random secret for signed staff session cookies. |
| `COFFEE_POS_OWNER_USERNAME` | Recommended | Seeded owner username, defaults to `admin` locally. |
| `COFFEE_POS_OWNER_PIN` | Recommended | Seeded owner PIN, defaults to `admin` locally. Rotate for staging/production. |
| `GEMINI_API_KEY` | Required for AI invoice parsing | Keep server-only. Do not prefix with `NEXT_PUBLIC_`. |
| `GEMINI_MODEL` | Recommended | Defaults to `gemini-flash-latest` if omitted. |
| `COFFEE_POS_QR_ENABLED` | Optional | Keep `false` until payment integration is ready. |
| `COFFEE_POS_QR_BANK_BIN` | QR only | VietQR bank BIN if QR checkout is enabled. |
| `COFFEE_POS_QR_BANK_NAME` | QR only | Display name for QR review screens. |
| `COFFEE_POS_QR_ACCOUNT_NUMBER` | QR only | Bank account number for QR generation. |
| `COFFEE_POS_QR_ACCOUNT_NAME` | QR only | Bank account name for QR generation. |
| `COFFEE_POS_QR_TEMPLATE` | QR only | VietQR template, defaults to `compact2`. |
| `COFFEE_POS_QR_EXPIRY_MINUTES` | QR only | Defaults to `10`. |
| `COFFEE_POS_TAX_RATE_PERCENT` | Optional | Defaults to `0`. |

payOS is not integrated in the current codebase. If a future payment integration adds payOS, add the project-specific payOS credentials, for example client ID, API key, and checksum key, as server-only Vercel env vars before enabling the flow.

## Local Vercel Env Verification

```bash
vercel link --yes
vercel env pull .env.local --yes
```

After pulling, compare required keys against `.env.example`. Never commit `.env.local`.

## Database Migration Workflow

Development:

```bash
pnpm db:generate
pnpm db:migrate:dev --name <short-change-name>
pnpm typecheck
pnpm build
```

Production/staging deployment while the existing database is not yet baselined in Prisma Migrate:

```bash
pnpm install --frozen-lockfile
pnpm db:push
pnpm build
```

The current live database predates Prisma migration history, so Vercel uses `db push` for additive schema synchronization. Before adopting `migrate deploy`, create and mark an explicit baseline for the existing production schema.

## Smoke Tests

Run against a local, staging, or preview URL:

```bash
SMOKE_BASE_URL=http://localhost:3000 SMOKE_USERNAME=admin SMOKE_PIN=admin pnpm smoke:pos
```

The smoke script verifies:

- POS order creation.
- Checkout/payment flow.
- Queue visibility.
- Inventory list.
- Report dashboard load.
- Settings page load.

The script writes test orders with `SMOKE_TEST` notes. Use a staging database or clean them up manually when needed.

## Screenshot Capture

Start the app, then run:

```bash
SMOKE_BASE_URL=http://localhost:3000 SMOKE_USERNAME=admin SMOKE_PIN=admin pnpm screenshots:qa
```

Screenshots are saved under `docs/assets/qa/`:

- `pos-desktop.png`
- `orders-desktop.png`
- `queue-desktop.png`
- `reports-desktop.png`
- `inventory-desktop.png`
- `settings-desktop.png`
- `pos-tablet.png`
- `pos-mobile.png`
- `admin-payroll-desktop.png`

## Staging Deployment Notes

1. Use a staging branch or Vercel Preview deployment.
2. Scope `DATABASE_URL`, `GEMINI_API_KEY`, and payment-related variables to Preview/Staging only.
3. The Vercel build command runs `pnpm db:push` before the app build. Confirm Preview uses the intended staging database before deploying.
4. Run `pnpm smoke:pos` against the preview URL.
5. Capture screenshots with `pnpm screenshots:qa` and review responsive layouts.

## Production Deployment Notes

1. Confirm staging smoke tests and screenshots are reviewed.
2. Verify production env vars are present in Vercel and scoped to Production.
3. The Vercel production build synchronizes the Prisma schema before building. Confirm `DATABASE_URL` is scoped to Production and take a backup before a schema-changing release.
4. Deploy with Vercel Git integration or:

```bash
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

5. After deploy, run smoke tests against the production URL with a test cashier/manager account.
6. Keep `COFFEE_POS_QR_ENABLED=false` unless payment reconciliation has been fully verified.
