import { z } from "zod";

export const salesReportQuerySchema = z.object({
  mode: z.enum(["day", "week", "month", "custom"]).default("month"),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  week: z.string().trim().regex(/^\d{4}-W\d{2}$/).optional(),
  month: z.string().trim().regex(/^\d{4}-\d{2}$/).optional(),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const salesReportExportQuerySchema = salesReportQuerySchema.extend({
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv")
});

export type SalesReportQueryInput = z.infer<typeof salesReportQuerySchema>;
export type SalesReportExportQueryInput = z.infer<typeof salesReportExportQuerySchema>;
