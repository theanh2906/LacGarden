import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value ? value : null));

const optionalShortText = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => (value ? value : null));

const optionalMoney = z.coerce.number().int().nonnegative().nullable().optional();
const dateOnlySchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTimeSchema = z.string().datetime();

export const staffOpsQuerySchema = z.object({
  startDate: dateOnlySchema.optional(),
  endDate: dateOnlySchema.optional()
});

export const upsertEmployeeProfileSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid().nullable().optional(),
  employeeCode: optionalShortText,
  displayName: z.string().trim().min(1).max(160),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "BARISTA", "VIEWER"]),
  scheduleRole: z.enum(["BAR", "CASHIER", "SERVICE", "MANAGER"]).default("SERVICE"),
  phone: optionalShortText,
  email: z
    .string()
    .trim()
    .email()
    .max(160)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  employmentStatus: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]).default("ACTIVE"),
  hourlyRateVnd: optionalMoney,
  salaryMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
  hiredAt: dateOnlySchema.nullable().optional(),
  terminatedAt: dateOnlySchema.nullable().optional(),
  note: optionalText
});

export const upsertStaffScheduleSchema = z.object({
  id: z.string().uuid().optional(),
  employeeProfileId: z.string().uuid(),
  scheduleDate: dateOnlySchema,
  startTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
  role: z.enum(["BAR", "CASHIER", "SERVICE", "MANAGER"]),
  status: z.enum(["SCHEDULED", "CONFIRMED", "CANCELLED"]).default("SCHEDULED"),
  note: optionalText
});

export const clockOutSchema = z.object({
  breakMinutes: z.coerce.number().int().min(0).max(720).default(0),
  note: optionalText
});

export const clockActionSchema = z.object({
  action: z.enum(["in", "out"])
});

export const timesheetActionSchema = z.object({
  employeeProfileId: z.string().uuid(),
  periodStart: dateOnlySchema,
  periodEnd: dateOnlySchema,
  action: z.enum(["submit", "approve", "reject"]),
  note: optionalText
});

export const createTimesheetAdjustmentSchema = z.object({
  timesheetId: z.string().uuid(),
  adjustmentType: z.enum(["TIME_CORRECTION", "BREAK_CORRECTION", "MANAGER_NOTE"]),
  minutesDelta: z.coerce.number().int().min(-1440).max(1440).default(0),
  reason: z.string().trim().min(1).max(500)
});

export type StaffOpsQueryInput = z.infer<typeof staffOpsQuerySchema>;
export type UpsertEmployeeProfileInput = z.infer<typeof upsertEmployeeProfileSchema>;
export type UpsertStaffScheduleInput = z.infer<typeof upsertStaffScheduleSchema>;
export type ClockOutInput = z.infer<typeof clockOutSchema>;
export type ClockActionInput = z.infer<typeof clockActionSchema>;
export type TimesheetActionInput = z.infer<typeof timesheetActionSchema>;
export type CreateTimesheetAdjustmentInput = z.infer<typeof createTimesheetAdjustmentSchema>;
