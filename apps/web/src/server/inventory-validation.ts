import { z } from "zod";

const optionalCode = z
  .string()
  .trim()
  .max(48)
  .optional()
  .transform((value) => (value ? value.toUpperCase() : null));

const patchCode = z
  .string()
  .trim()
  .max(48)
  .optional()
  .transform((value) => (value === undefined ? undefined : value ? value.toUpperCase() : null));

const optionalNote = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value ? value : null));

const patchNote = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value === undefined ? undefined : value ? value : null));

const moneyVndSchema = z.coerce.number().int().nonnegative();
const quantitySchema = z.coerce.number().finite();
const positiveQuantitySchema = quantitySchema.positive();
const nonNegativeQuantitySchema = quantitySchema.nonnegative();

export const inventoryStatusFilterSchema = z.enum(["all", "active", "low-stock", "out-of-stock", "inactive"]).default("all");

export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: optionalCode,
  unit: z.string().trim().min(1).max(24),
  currentQuantity: nonNegativeQuantitySchema.default(0),
  lowStockThreshold: nonNegativeQuantitySchema.default(0),
  note: optionalNote
});

export const updateInventoryItemSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  code: patchCode,
  unit: z.string().trim().min(1).max(24).optional(),
  lowStockThreshold: nonNegativeQuantitySchema.optional(),
  isActive: z.coerce.boolean().optional(),
  note: patchNote
});

export const createStockMovementSchema = z.object({
  inventoryItemId: z.string().uuid(),
  movementType: z.enum(["PURCHASE", "ADJUSTMENT", "WASTE", "CORRECTION"]),
  quantity: positiveQuantitySchema.optional(),
  quantityDelta: quantitySchema.optional(),
  finalQuantity: nonNegativeQuantitySchema.optional(),
  purchaseDate: z.string().datetime().optional(),
  unitCostVnd: moneyVndSchema.optional(),
  totalCostVnd: moneyVndSchema.optional(),
  note: optionalNote,
  createdById: z.string().uuid().optional()
});

export const updateImportRowsSchema = z.object({
  rows: z.array(
    z.object({
      id: z.string().uuid(),
      normalizedName: z.string().trim().min(1).max(160),
      unit: z.string().trim().min(1).max(24).nullable().optional(),
      quantity: nonNegativeQuantitySchema.nullable().optional(),
      unitCostVnd: moneyVndSchema.nullable().optional(),
      totalCostVnd: moneyVndSchema.nullable().optional(),
      purchaseDate: z.string().datetime().nullable().optional(),
      skip: z.boolean().optional()
    })
  )
});

export const confirmImportSchema = z.object({
  rowIds: z.array(z.string().uuid()).optional()
});

export const inventoryReportQuerySchema = z.object({
  mode: z.enum(["day", "month", "year", "custom"]).default("month"),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().trim().regex(/^\d{4}-\d{2}$/).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const inventoryReportExportQuerySchema = inventoryReportQuerySchema.extend({
  format: z.enum(["csv", "xlsx"]).default("csv")
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type UpdateImportRowsInput = z.infer<typeof updateImportRowsSchema>;
export type ConfirmImportInput = z.infer<typeof confirmImportSchema>;
export type InventoryReportQueryInput = z.infer<typeof inventoryReportQuerySchema>;
export type InventoryReportExportQueryInput = z.infer<typeof inventoryReportExportQuerySchema>;
