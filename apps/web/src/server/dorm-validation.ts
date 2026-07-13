import { z } from "zod";

const money = z.coerce.number().int().nonnegative();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createDormSiteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: optionalText(300),
  note: optionalText(500)
});

export const createDormRoomSchema = z.object({
  siteId: z.string().uuid(),
  code: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(120),
  bedCount: z.coerce.number().int().min(1).max(32),
  monthlyRentVnd: money.default(0),
  note: optionalText(500)
});

export const createDormTenantSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(32),
  email: z.string().trim().email().max(160).optional().or(z.literal("")).transform((value) => value || null),
  identityNumber: optionalText(48),
  emergencyContact: optionalText(160),
  note: optionalText(500)
});

export const createDormLeaseSchema = z.object({
  tenantId: z.string().uuid(),
  bedId: z.string().uuid(),
  startDate: isoDate,
  dueDay: z.coerce.number().int().min(1).max(28).default(5),
  monthlyRentVnd: money,
  depositVnd: money.default(0),
  note: optionalText(500)
});

export const createDormInvoiceSchema = z.object({
  leaseId: z.string().uuid(),
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/),
  dueDate: isoDate,
  electricityVnd: money.default(0),
  waterVnd: money.default(0),
  serviceVnd: money.default(0),
  otherVnd: money.default(0),
  note: optionalText(500)
});

export const createDormPaymentSchema = z.object({
  amountVnd: z.coerce.number().int().positive(),
  method: z.enum(["CASH", "BANK_TRANSFER", "QR", "CARD", "OTHER"]),
  reference: optionalText(120),
  receivedAt: z.string().datetime().optional(),
  note: optionalText(500)
});

export type CreateDormSiteInput = z.infer<typeof createDormSiteSchema>;
export type CreateDormRoomInput = z.infer<typeof createDormRoomSchema>;
export type CreateDormTenantInput = z.infer<typeof createDormTenantSchema>;
export type CreateDormLeaseInput = z.infer<typeof createDormLeaseSchema>;
export type CreateDormInvoiceInput = z.infer<typeof createDormInvoiceSchema>;
export type CreateDormPaymentInput = z.infer<typeof createDormPaymentSchema>;
