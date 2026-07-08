import { z } from "zod";

const positiveQuantity = z.coerce.number().int().min(1).max(99);
const optionalIntegerVnd = z.coerce.number().int().min(0).optional();

export const orderLineSchema = z.object({
  menuItemId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: positiveQuantity,
  modifiers: z.array(z.string().trim().min(1).max(64)).max(8).default([]),
  note: z.string().trim().max(500).optional()
});

export const createOrderSchema = z.object({
  orderType: z.enum(["TAKEAWAY", "DINE_IN", "DELIVERY"]).default("TAKEAWAY"),
  note: z.string().trim().max(1000).optional(),
  items: z.array(orderLineSchema).min(1).max(99)
});

export const checkoutOrderSchema = createOrderSchema.extend({
  paymentMethod: z.enum(["CASH", "CARD"]).default("CASH"),
  receivedAmount: optionalIntegerVnd,
  note: z.string().trim().max(1000).optional()
});

export const qrCheckoutOrderSchema = createOrderSchema;

export const addPaymentSchema = z.object({
  method: z.enum(["CASH", "BANK_TRANSFER", "QR", "CARD", "OTHER"]).default("CASH"),
  amount: z.coerce.number().int().min(1),
  receivedAmount: optionalIntegerVnd,
  note: z.string().trim().max(1000).optional()
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["SENT", "PREPARING", "READY", "SERVED", "CLOSED", "CANCELLED"])
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;
export type AddPaymentInput = z.infer<typeof addPaymentSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
