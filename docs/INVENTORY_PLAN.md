# Inventory Management Plan

## 1. Summary

This plan designs a desktop-first Inventory Management feature for the Coffee POS app without changing the current mock POS behavior. The project should keep the current Next.js App Router structure, PostgreSQL/Prisma foundation, integer VND money handling, and lazy server-side clients.

Recommended MVP architecture:

- Keep Inventory inside the existing fullstack Next.js app as a modular monolith.
- Add inventory Prisma models alongside the current `User`, `MenuItem`, `Order`, `Payment`, and `Shift` concepts.
- Use a stock ledger model (`StockMovement`) as the source of truth for inventory history.
- Keep a denormalized `currentQuantity` on each ingredient for fast dashboard and alert reads, updated transactionally when stock movements are created.
- Use server-side inventory services under the web app; route handlers should stay thin and only validate input, call services, and return JSON.
- Use Gemini only for parsing uploaded Excel/TXT import contents into structured draft rows. Human review is required before anything is saved as real inventory data.

MVP goals:

- Manage ingredients/materials and low-stock thresholds.
- Record purchases, adjustments, waste/loss, and manual correction movements.
- Upload purchase invoice/receipt files and link them to purchase movements.
- Import long ingredient lists from Excel/TXT with Gemini-assisted parsing and review.
- View inventory dashboard, history, reports, charts, low-stock alerts, and exports.

## 2. Current Repository Context

Observed current state:

- `apps/web` is the Next.js App Router app using TypeScript and SCSS.
- `apps/web/src/components/pos-demo/PosDemo.tsx` contains the current mock POS UI and a placeholder Inventory view.
- `apps/web/src/data/mock-pos.ts` provides mock menu, order, and bar queue data.
- `apps/web/prisma/schema.prisma` currently contains users, menu categories/items/variants, shifts, orders, order items, and payments.
- `apps/web/src/server/db.ts` exposes a lazy Prisma client getter. Inventory services should follow this pattern.
- `packages/shared/src/index.ts` contains shared constants/helpers, but the web app currently still uses local helpers for some formatting.

The Inventory feature should be added as new admin functionality and must not break the existing POS mock flow.

## 3. MVP Scope

In scope:

- Ingredient/material master data:
  - name
  - category
  - unit
  - current quantity
  - low-stock threshold
  - warning-stock threshold
  - active/inactive status
  - supplier notes and internal notes
- Purchase entry:
  - ingredient
  - quantity
  - purchase date
  - supplier
  - unit cost in integer VND
  - total cost in integer VND
  - invoice/receipt reference
  - optional expiry date and batch note
- Stock movements:
  - `PURCHASE`
  - `ADJUSTMENT`
  - `WASTE_LOSS`
  - `MANUAL_CORRECTION`
- Invoice/receipt upload:
  - store file metadata and server-side storage key/path
  - link invoices to purchase movements
  - support reconciliation status
- Inventory reports:
  - daily, monthly, yearly filters
  - stock level
  - purchase cost
  - usage/waste trend
  - low-stock list
  - CSV export for MVP
  - XLSX export if the project adds a spreadsheet dependency
- Desktop-first admin UI:
  - dashboard
  - ingredients list
  - ingredient detail/history
  - purchase entry
  - import review
  - invoice/reconciliation
  - reports/export
- Gemini import parsing:
  - Excel/TXT upload
  - server extracts file text/tabular contents
  - Gemini model `gemini-flash-latest` converts contents to structured draft rows
  - app validates and shows review table
  - admin approves before saving

Out of MVP scope:

- Multi-branch or multi-warehouse inventory.
- Automatic ingredient deduction from POS orders through recipes/BOM.
- Full accounting ledger integration.
- Payroll, salary, tax filing, or government tax submission.
- OCR for image/PDF invoice parsing.
- Vendor portal or purchase order approval workflow.
- Barcode scanning.
- Real-time collaborative editing.
- Offline conflict resolution across multiple devices.

## 4. Proposed Database Model

Use PostgreSQL as the source of truth. Quantities should support decimal values because ingredients may be tracked in kg, g, l, ml, packs, or pieces. Money remains integer VND.

Proposed enums:

```prisma
enum StockMovementType {
  PURCHASE
  ADJUSTMENT
  WASTE_LOSS
  MANUAL_CORRECTION
}

enum InventoryImportStatus {
  UPLOADED
  PARSED
  REVIEWED
  COMMITTED
  FAILED
}

enum InvoiceStatus {
  DRAFT
  UPLOADED
  PARTIALLY_RECONCILED
  RECONCILED
  VOIDED
}
```

Proposed models:

### Ingredient

Stores the ingredient/material master record.

Important fields:

- `id`
- `name`
- `category`
- `unit`
- `currentQuantity Decimal`
- `lowStockThreshold Decimal`
- `warningStockThreshold Decimal?`
- `defaultUnitCost Int?`
- `preferredSupplierId String?`
- `isActive Boolean`
- `note String?`
- `createdAt`
- `updatedAt`

Relationships:

- `preferredSupplier` optional relation to `Supplier`
- one-to-many with `StockMovement`
- one-to-many with `InventoryImportRow`

Indexes:

- `[isActive, name]`
- `[category]`
- `[currentQuantity]`

### Supplier

Stores simple vendor metadata for purchase tracking.

Important fields:

- `id`
- `name`
- `phone`
- `email`
- `taxCode`
- `address`
- `note`
- `isActive`
- `createdAt`
- `updatedAt`

Relationships:

- one-to-many with `PurchaseInvoice`
- one-to-many with `StockMovement`
- optional one-to-many as preferred supplier for ingredients

### PurchaseInvoice

Represents one purchase receipt/invoice to reconcile with purchase stock movements.

Important fields:

- `id`
- `supplierId String?`
- `invoiceNo String?`
- `purchaseDate DateTime`
- `status InvoiceStatus`
- `subtotalVnd Int`
- `taxVnd Int`
- `totalVnd Int`
- `note String?`
- `uploadedById String`
- `createdAt`
- `updatedAt`

Relationships:

- optional relation to `Supplier`
- relation to uploading `User`
- one-to-many with `InvoiceFile`
- one-to-many with `StockMovement`

Indexes:

- `[purchaseDate]`
- `[status]`
- `[supplierId, purchaseDate]`

### InvoiceFile

Stores uploaded invoice/receipt file metadata.

Important fields:

- `id`
- `invoiceId String`
- `originalName String`
- `mimeType String`
- `sizeBytes Int`
- `sha256 String`
- `storageKey String`
- `uploadedAt DateTime`

Relationships:

- many-to-one with `PurchaseInvoice`

The actual file should live outside the database. For local-first MVP, use a server-side upload directory configured by environment variable. Later this can be swapped for object storage without changing the inventory domain model.

### StockMovement

Inventory ledger. This is the source of truth for stock history and reports.

Important fields:

- `id`
- `ingredientId String`
- `type StockMovementType`
- `quantityDelta Decimal`
- `quantityAfter Decimal`
- `unit String`
- `unitCostVnd Int?`
- `totalCostVnd Int?`
- `purchaseDate DateTime?`
- `supplierId String?`
- `invoiceId String?`
- `reason String?`
- `note String?`
- `createdById String`
- `createdAt DateTime`

Rules:

- `PURCHASE` must have positive `quantityDelta`.
- `WASTE_LOSS` must have negative `quantityDelta`.
- `ADJUSTMENT` may be positive or negative.
- `MANUAL_CORRECTION` stores the delta needed to reach the admin-entered final stock count.
- `quantityAfter` is written transactionally and should match the ingredient's updated `currentQuantity`.
- Purchase-related money fields are integer VND.

Relationships:

- many-to-one with `Ingredient`
- optional many-to-one with `Supplier`
- optional many-to-one with `PurchaseInvoice`
- many-to-one with creating `User`

Indexes:

- `[ingredientId, createdAt]`
- `[type, createdAt]`
- `[invoiceId]`
- `[purchaseDate]`

### InventoryImportJob

Tracks uploaded Excel/TXT import jobs and Gemini parse lifecycle.

Important fields:

- `id`
- `fileName String`
- `mimeType String`
- `storageKey String`
- `status InventoryImportStatus`
- `sourceTextPreview String?`
- `geminiModel String`
- `geminiPromptVersion String`
- `parseError String?`
- `createdById String`
- `createdAt`
- `updatedAt`
- `committedAt DateTime?`

Relationships:

- many-to-one with creating `User`
- one-to-many with `InventoryImportRow`

### InventoryImportRow

Stores parsed draft rows before admin review and after commit.

Important fields:

- `id`
- `jobId String`
- `rowIndex Int`
- `rawText String?`
- `ingredientName String`
- `matchedIngredientId String?`
- `unit String?`
- `quantity Decimal?`
- `purchaseDate DateTime?`
- `supplierName String?`
- `unitCostVnd Int?`
- `totalCostVnd Int?`
- `confidence Decimal?`
- `validationStatus String`
- `validationMessage String?`
- `commitStatus String`
- `createdIngredientId String?`
- `createdMovementId String?`

Relationships:

- many-to-one with `InventoryImportJob`
- optional many-to-one with matched `Ingredient`
- optional relation to created `Ingredient`
- optional relation to created `StockMovement`

## 5. Service and API Boundaries

Keep route handlers thin. Business logic should live in server-side modules, using the lazy Prisma client pattern.

Suggested server modules:

- `inventoryIngredientService`
  - list/search ingredients
  - create/update/deactivate ingredient
  - update thresholds
  - compute alert state
- `stockMovementService`
  - create movement in a transaction
  - update `Ingredient.currentQuantity`
  - write `quantityAfter`
  - validate movement type rules
- `purchaseInvoiceService`
  - create/update invoice metadata
  - attach uploaded files
  - link invoice to purchase movements
  - compute reconciliation status
- `inventoryImportService`
  - store uploaded import files
  - extract Excel/TXT contents
  - call Gemini parser
  - validate parsed rows
  - commit approved rows in a transaction
- `inventoryReportService`
  - aggregate report metrics
  - prepare graph datasets
  - export CSV/XLSX

Suggested route handlers:

- `GET /api/inventory/ingredients`
  - filters: `q`, `category`, `status`, `alert`
- `POST /api/inventory/ingredients`
- `GET /api/inventory/ingredients/[id]`
- `PATCH /api/inventory/ingredients/[id]`
- `GET /api/inventory/movements`
  - filters: `ingredientId`, `type`, `from`, `to`
- `POST /api/inventory/movements`
- `GET /api/inventory/invoices`
- `POST /api/inventory/invoices`
- `POST /api/inventory/invoices/[id]/files`
- `PATCH /api/inventory/invoices/[id]/reconcile`
- `POST /api/inventory/imports`
  - upload Excel/TXT file and create import job
- `POST /api/inventory/imports/[id]/parse`
  - extract contents and call Gemini
- `GET /api/inventory/imports/[id]`
  - return draft rows and validation results
- `PATCH /api/inventory/imports/[id]/rows`
  - allow admin corrections before commit
- `POST /api/inventory/imports/[id]/commit`
- `GET /api/inventory/reports`
  - query: `period=day|month|year`, `from`, `to`, `metric`
- `GET /api/inventory/reports/export`
  - query: same report filters plus `format=csv|xlsx`
- `GET /api/inventory/alerts`

Validation:

- Use Zod schemas for request bodies and parsed import rows.
- Reject invalid quantities, missing required units, negative purchase costs, and invalid dates.
- Do not allow direct client writes to `currentQuantity`; all stock quantity changes must go through `StockMovement`.

## 6. Desktop-First UI and UX Flow

Recommended admin route:

- Add a dedicated inventory admin area such as `/inventory` or `/admin/inventory`.
- Keep the current POS mock page untouched until the inventory feature is ready to link from navigation.

Desktop layout:

- Persistent left navigation for Inventory sections.
- Top toolbar with date range, search, import button, export button, and create movement button.
- Dense tables with sortable columns, sticky headers, filters, and row detail side panels.
- Avoid mobile-first compromises for MVP; tablet/mobile can be responsive but not the primary optimization target.

Screens:

### Inventory Dashboard

Shows:

- total active ingredients
- low-stock count
- total stock value estimate
- purchase cost this month
- waste/loss this month
- charts:
  - stock level trend
  - purchase cost by day/month
  - usage/waste trend
  - low-stock items
- alert panel sorted by severity

### Ingredients

Table columns:

- ingredient name
- category
- unit
- current quantity
- warning threshold
- low threshold
- supplier
- status
- last movement date

Actions:

- create ingredient
- edit ingredient metadata
- deactivate ingredient
- open detail/history
- quick movement entry

### Ingredient Detail

Shows:

- current quantity and alert state
- threshold settings
- movement history
- purchase history
- linked invoices
- chart of stock level over time

### Stock Movement Entry

Form fields:

- movement type
- ingredient
- quantity
- purchase date when applicable
- supplier when applicable
- unit cost and total cost when applicable
- invoice link when applicable
- reason/note

UX rules:

- Preview resulting stock quantity before saving.
- Require reason for `ADJUSTMENT`, `WASTE_LOSS`, and `MANUAL_CORRECTION`.
- Manual correction input should ask for final counted quantity, then the service calculates the delta.

### Invoice/Reconciliation

Screens:

- invoice list
- invoice detail
- upload file panel
- linked purchase movements
- reconciliation status

Workflow:

1. Admin creates invoice metadata or starts from file upload.
2. Admin uploads receipt/invoice file.
3. Admin records purchase movements or links existing purchase movements.
4. App compares invoice total with linked movement totals.
5. App marks invoice `RECONCILED` only when linked movement totals match invoice total, or `PARTIALLY_RECONCILED` otherwise.

### Import Review

Workflow-oriented screen:

1. Upload Excel/TXT.
2. Parse with Gemini.
3. Review rows in a spreadsheet-like table.
4. Fix validation errors.
5. Choose whether each row creates a new ingredient, updates an existing ingredient, records a purchase movement, or is skipped.
6. Commit approved rows.
7. Show import summary with created ingredients, created movements, skipped rows, and errors.

### Reports

Report tabs:

- Stock levels
- Purchases
- Waste/loss
- Low stock
- Ingredient history

Filters:

- period: day, month, year
- date range
- ingredient
- category
- supplier
- movement type

Exports:

- CSV for MVP
- XLSX when spreadsheet dependency is added

## 7. Excel/TXT Import Workflow

Supported files:

- `.xlsx`
- `.xls` if the selected parser supports it
- `.csv`
- `.txt`

MVP import process:

1. Admin uploads file.
2. Server stores the original file and creates `InventoryImportJob` with status `UPLOADED`.
3. Server extracts readable contents:
   - Excel/CSV: rows and columns with sheet names when available.
   - TXT: raw text split into candidate lines.
4. Server sends normalized contents to Gemini model `gemini-flash-latest`.
5. Gemini returns structured JSON draft rows.
6. Server validates the JSON against the import row schema.
7. Server attempts ingredient matching by normalized name and optional unit.
8. UI shows all rows for human review.
9. Admin edits rows, resolves duplicates, and selects commit actions.
10. Commit creates ingredients and/or purchase stock movements in one transaction per approved row or one batch transaction when safe.

Parsed row target shape:

```ts
type ParsedInventoryImportRow = {
  ingredientName: string;
  unit?: string;
  quantity?: number;
  purchaseDate?: string;
  supplierName?: string;
  unitCostVnd?: number;
  totalCostVnd?: number;
  category?: string;
  note?: string;
  confidence?: number;
};
```

Human review is mandatory. Gemini output must never directly write to `Ingredient` or `StockMovement`.

Validation rules:

- `ingredientName` is required.
- `unit` is required before commit.
- `quantity` is required and must be greater than zero when creating a purchase movement.
- `purchaseDate` is required for purchase rows.
- `unitCostVnd` and `totalCostVnd` must be integer VND when present.
- If both `unitCostVnd` and `quantity` are present but `totalCostVnd` is missing, calculate total as `unitCostVnd * quantity` and round to integer VND.
- Flag low-confidence rows for manual review.
- Flag duplicate ingredient names in the same import.
- Flag unit mismatch against existing ingredient records.

Gemini service requirements:

- Create a lazy server-side Gemini client helper, similar in spirit to the existing lazy Prisma helper.
- Configure API key through environment variable, for example `GEMINI_API_KEY`.
- Store model name `gemini-flash-latest` in server config.
- Use a fixed prompt version string and store it on `InventoryImportJob`.
- Request JSON-only structured output.
- Keep raw uploaded file and parsed rows for audit/debugging.
- On Gemini failure, preserve the import job with status `FAILED` and show parse error to admin.

## 8. Invoice Upload and Reconciliation Workflow

MVP invoice upload:

- Accept image/PDF files for storage and manual review.
- Store file outside PostgreSQL.
- Store metadata in `InvoiceFile`.
- Link each file to `PurchaseInvoice`.

MVP reconciliation:

- Purchase movements may optionally link to a `PurchaseInvoice`.
- Invoice detail page shows:
  - invoice total
  - linked purchase movement total
  - difference
  - reconciliation status
- `RECONCILED` means invoice total equals linked movement total.
- `PARTIALLY_RECONCILED` means at least one movement is linked but totals do not match.
- `UPLOADED` means invoice file exists but no movements are linked yet.
- `VOIDED` means invoice should not be used in reports.

Invoice parsing is out of MVP unless the uploaded invoice is also a supported Excel/TXT import file.

## 9. Reports, Charts, and Exports

Dashboard/report metrics:

- Stock level by ingredient over time.
- Purchase cost by day/month/year.
- Purchase quantity by ingredient/category/supplier.
- Waste/loss quantity and estimated cost.
- Manual correction count and quantity impact.
- Low-stock ingredient list by severity.

Chart datasets:

- line chart: stock level trend
- bar chart: purchase cost over time
- bar/line chart: usage and waste trend
- table/bar chart: low-stock items

Report filters:

- period: day, month, year
- date range
- ingredient
- category
- supplier
- movement type

Export requirements:

- CSV export is required for MVP.
- XLSX export can be added if a spreadsheet package is accepted.
- Exported money values are integer VND.
- Exported quantities include unit column.
- Export files should reflect the same filters as the visible report.

## 10. Low-Stock Alert Rules

Alert states:

- `OK`: `currentQuantity > warningStockThreshold`
- `NEAR_LOW`: `currentQuantity <= warningStockThreshold` and `currentQuantity > lowStockThreshold`
- `BELOW_LOW`: `currentQuantity <= lowStockThreshold`

Defaults:

- Each ingredient has required `lowStockThreshold`.
- `warningStockThreshold` is optional.
- If `warningStockThreshold` is missing, use `lowStockThreshold * 1.25` for dashboard warning calculations.

UX:

- Show alert badge in ingredient list and dashboard.
- Sort alerts by `BELOW_LOW` first, then `NEAR_LOW`.
- Include current quantity, unit, low threshold, warning threshold, and last movement date.
- Alerts are recalculated whenever ingredients are listed or stock movements are created.

MVP does not need email/SMS/push notifications.

## 11. Implementation Sequence

Recommended delivery order:

1. Add documentation and confirm MVP decisions.
2. Add Prisma inventory models and generate client.
3. Add inventory service layer and Zod schemas.
4. Add ingredient CRUD APIs and admin screens.
5. Add stock movement APIs and transaction-safe quantity updates.
6. Add low-stock alerts and dashboard cards.
7. Add purchase invoice upload metadata and reconciliation.
8. Add import job models and file upload.
9. Add Gemini parsing service and import review UI.
10. Add reports and CSV export.
11. Add charts and polish desktop admin UX.

This sequence keeps the current POS UI working and allows inventory to be built behind a new admin route before linking it into the existing navigation.

## 12. Testing and Acceptance Criteria

Data/model tests:

- Creating a purchase movement increases ingredient current quantity.
- Creating a waste/loss movement decreases ingredient current quantity.
- Manual correction stores the correct delta and final `quantityAfter`.
- Invalid negative purchase movement is rejected.
- Money fields reject non-integer VND values.
- Low-stock alert state changes when current quantity crosses thresholds.

API tests:

- Ingredient list supports search/filter.
- Stock movement creation validates movement-specific rules.
- Invoice reconciliation status updates from uploaded to partial/reconciled.
- Import parse failure keeps job inspectable.
- Import commit does not save invalid rows.

UI acceptance:

- Admin can create/edit/deactivate ingredients.
- Admin can record purchase, adjustment, waste/loss, and manual correction.
- Admin can see inventory history by ingredient and date range.
- Admin can upload an invoice/receipt and link purchase movements.
- Admin can import an Excel/TXT ingredient list, review parsed rows, fix validation errors, and commit approved rows.
- Admin can view daily/monthly/yearly reports and export filtered results.
- Dashboard displays stock, cost, usage, and low-stock graphs.

Regression checks:

- Existing POS mock page still loads.
- Existing mock Orders, Queue, Reports, Inventory, and Settings views still render until intentionally replaced.
- `pnpm typecheck` and `pnpm build` pass after implementation.

## 13. Open Questions

- Should the production admin route be `/inventory` or `/admin/inventory`?
- Which file storage target should be used first: local filesystem only, Vercel Blob, S3-compatible storage, or another provider?
- Should XLSX export be part of MVP, or is CSV enough for the first release?
- Are supplier records required in MVP, or can supplier be a free-text field initially?
- Should purchase invoice totals include tax fields now, or should tax detail wait for the accounting module?
- Which units should be offered by default for coffee shop inventory: `g`, `kg`, `ml`, `l`, `piece`, `pack`, `box`, `bottle`, `bag`?
- Should import commit create purchase movements by default, or only create/update ingredient master data unless the admin explicitly chooses purchase mode?

## 14. Assumptions

- Single shop/location inventory is enough for MVP.
- PostgreSQL remains the source of truth.
- Prisma remains the database access layer.
- Inventory quantities may be decimal.
- Money remains integer VND.
- Gemini is only used server-side.
- Gemini output is untrusted and always goes through validation plus human review.
- Invoice image/PDF OCR is not required in MVP.
- Recipes/BOM and automatic stock deduction from POS sales will be designed later.
- Existing POS UI should remain stable while inventory is developed behind a dedicated admin route.
