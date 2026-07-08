# QA Polish Notes

Last verified locally against `http://localhost:3000`.

## Responsive Viewports Reviewed

| Surface | Viewport | Evidence |
| --- | --- | --- |
| POS desktop | 1440x900 | `docs/assets/qa/pos-desktop.png` |
| POS tablet | 1024x768 | `docs/assets/qa/pos-tablet.png` |
| POS mobile | 390x844 | `docs/assets/qa/pos-mobile.png` |
| Admin desktop | 1440x900 | `docs/assets/qa/reports-desktop.png`, `docs/assets/qa/inventory-desktop.png`, `docs/assets/qa/admin-payroll-desktop.png` |

## Screenshot Inventory

- `docs/assets/qa/pos-desktop.png`
- `docs/assets/qa/orders-desktop.png`
- `docs/assets/qa/queue-desktop.png`
- `docs/assets/qa/reports-desktop.png`
- `docs/assets/qa/inventory-desktop.png`
- `docs/assets/qa/settings-desktop.png`
- `docs/assets/qa/pos-tablet.png`
- `docs/assets/qa/pos-mobile.png`
- `docs/assets/qa/admin-payroll-desktop.png`

## Findings

- Fixed mobile POS topbar wrapping: the logout icon previously wrapped onto its own row at 390px wide. The mobile status rail now keeps both status cells and two icon buttons on one row.
- Production screenshots are captured via `next start` to avoid Next.js dev indicator artifacts.

## Smoke Test Coverage

Run:

```bash
pnpm smoke:pos
```

Verified flows:

- POS order creation.
- Checkout/payment flow.
- Queue visibility.
- Inventory list.
- Report dashboard load.
- Settings page load.

Known limitation: the smoke script creates real `SMOKE_TEST` orders in the configured database. Run it against staging or clean up smoke data manually when needed.

## Screenshot Reproduction

Run:

```bash
pnpm screenshots:qa
```

The script logs in using `SMOKE_USERNAME` and `SMOKE_PIN`, writes a temporary Playwright storage state, captures screenshots, then removes the temporary auth file. `docs/assets/qa/auth-state.json` is gitignored as a safety net.

## Deployment Readiness

See `docs/DEPLOYMENT.md` for required Vercel env vars, migration commands, staging rollout steps, production rollout steps, and the note that payOS credentials are not required until a payOS integration exists.
