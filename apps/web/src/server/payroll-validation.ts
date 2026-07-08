import { z } from "zod";

const dateOnlySchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value ? value : null));

export const payrollQuerySchema = z.object({
  startDate: dateOnlySchema.optional(),
  endDate: dateOnlySchema.optional()
});

export const generatePayrollRunSchema = z.object({
  startDate: dateOnlySchema,
  endDate: dateOnlySchema,
  note: optionalText
});

export const reviewPayrollRunSchema = z.object({
  runId: z.string().uuid(),
  action: z.enum(["mark_reviewed", "approve", "reopen"]),
  note: optionalText
});

export const createPayrollAdjustmentSchema = z.object({
  lineId: z.string().uuid(),
  adjustmentType: z.enum(["BONUS", "DEDUCTION"]),
  amountVnd: z.coerce.number().int().min(1),
  reason: z.string().trim().min(1).max(500)
});

export const payrollExportQuerySchema = payrollQuerySchema.extend({
  format: z.enum(["csv", "xlsx"]).default("csv")
});

export type PayrollQueryInput = z.infer<typeof payrollQuerySchema>;
export type GeneratePayrollRunInput = z.infer<typeof generatePayrollRunSchema>;
export type ReviewPayrollRunInput = z.infer<typeof reviewPayrollRunSchema>;
export type CreatePayrollAdjustmentInput = z.infer<typeof createPayrollAdjustmentSchema>;
export type PayrollExportQueryInput = z.infer<typeof payrollExportQuerySchema>;
