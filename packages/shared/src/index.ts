export const USER_ROLES = ["OWNER", "MANAGER", "CASHIER", "BARISTA", "VIEWER"] as const;
export const ORDER_STATUSES = ["DRAFT", "SENT", "PREPARING", "READY", "SERVED", "CLOSED", "CANCELLED"] as const;
export const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID", "REFUNDED"] as const;
export const ORDER_ITEM_STATUSES = ["NEW", "SENT", "PREPARING", "READY", "SERVED", "CANCELLED"] as const;
export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "QR", "CARD", "OTHER"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(amount);
}

export function calculatePaymentStatus(total: number, paid: number): PaymentStatus {
  if (paid <= 0) return "UNPAID";
  if (paid < total) return "PARTIAL";
  return "PAID";
}

export function calculateChange(received: number, due: number): number {
  return Math.max(0, received - due);
}
