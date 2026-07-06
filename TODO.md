# TODO

## Product Polish

- [ ] Review all responsive layouts on tablet and mobile POS viewports.
- [ ] Capture updated screenshots for POS, Orders, Queue, Reports, Inventory, and Settings.

## Payment QR

- [ ] Add a payment method selector in checkout: cash, card, bank transfer QR.
- [ ] Generate a dynamic VietQR/payOS QR for each order with amount and order code.
- [ ] Add a payment modal showing QR code, amount, order code, and expiry state.
- [ ] Add manual bank-transfer confirmation before webhook automation is available.
- [ ] Integrate payOS create-payment-link API after backend credentials are available.
- [ ] Add payOS webhook handler to auto-mark orders as paid.
- [ ] Verify webhook signatures before updating payment status.
- [ ] Trigger speaker/TTS announcement after webhook confirms successful payment.
- [ ] Announce paid amount and order code, for example: "Da thanh toan 107.120 dong cho don T-1030".
- [ ] Prevent duplicate speaker announcements for retried or duplicated webhooks.
- [ ] Store payment provider reference, paid amount, paid time, and reconciliation status.
- [ ] Add failed, cancelled, expired, and duplicate-payment handling.

## Product Costing

- [ ] Add recipe/BOM setup for each menu item.
- [ ] Calculate product cost from ingredient quantity, unit cost, and packaging cost.
- [ ] Track gross margin per item based on selling price and calculated cost.
- [ ] Add cost history so margin reports can use the cost at time of sale.
- [ ] Warn when a product margin drops below configured threshold.

## Analytics and Reports

- [ ] Add favorite-item analytics by quantity sold and revenue contribution.
- [ ] Add time-based filters for daily, weekly, monthly, and custom date ranges.
- [ ] Add revenue dashboard with graph visualizations for sales, order count, average order value, and payment method split.
- [ ] Add product performance report with best sellers, slow movers, and gross margin.
- [ ] Add export options for CSV, Excel, and PDF reports.
- [ ] Add tax report with taxable revenue, tax amount, discounts, service charge, and payment reconciliation.
- [ ] Add report permissions for manager/admin roles.

## Staff Operations

- [ ] Add employee profile management.
- [ ] Add shift scheduling for bar, cashier, service, and manager roles.
- [ ] Add clock-in and clock-out flow for employee timekeeping.
- [ ] Track breaks, late arrivals, early leave, overtime, and missed punches.
- [ ] Add timesheet approval workflow for managers.
- [ ] Calculate salary from hourly rate, fixed salary, overtime, bonus, deduction, and approved work hours.
- [ ] Add payroll report by employee and pay period.
- [ ] Add payroll export for accounting review.

## Backend Integration

- [ ] Add staff auth/session handling.
- [ ] Add receipt and bar-ticket printable views.

## Operations

- [ ] Verify Vercel production environment includes `DATABASE_URL`, `GEMINI_API_KEY`, and `GEMINI_MODEL`.
- [ ] Add database migration workflow.
- [ ] Add basic smoke tests for key POS flows.
- [ ] Add deployment notes for staging and production environments.
