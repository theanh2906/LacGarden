export type CheckoutPaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER";

export type QrPaymentRequest = {
  paymentId: string;
  orderId: string;
  orderNo: string;
  amount: number;
  provider: string;
  providerReference: string;
  qrImageUrl: string;
  qrContent: string;
  expiresAt: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
};
