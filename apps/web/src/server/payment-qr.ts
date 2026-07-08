import "server-only";

import type { QrPaymentRequest } from "@/types/payment";

const DEFAULT_QR_TEMPLATE = "compact2";
const DEFAULT_QR_EXPIRY_MINUTES = 10;
const VIETQR_IMAGE_BASE_URL = "https://img.vietqr.io/image";
const QR_ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export class PaymentQrConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentQrConfigError";
  }
}

export function isBankTransferQrEnabled() {
  return QR_ENABLED_VALUES.has(process.env.COFFEE_POS_QR_ENABLED?.trim().toLowerCase() ?? "");
}

export function createBankTransferQrRequest({
  paymentId,
  orderId,
  orderNo,
  amount,
  expiresAt
}: {
  paymentId: string;
  orderId: string;
  orderNo: string;
  amount: number;
  expiresAt?: Date;
}): QrPaymentRequest {
  const config = getBankTransferConfig();
  const providerReference = buildProviderReference(orderNo);
  const resolvedExpiresAt = expiresAt ?? new Date(Date.now() + config.expiryMinutes * 60_000);
  const qrContent = providerReference;
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: qrContent,
    accountName: config.accountName
  });

  return {
    paymentId,
    orderId,
    orderNo,
    amount,
    provider: "vietqr",
    providerReference,
    qrImageUrl: `${VIETQR_IMAGE_BASE_URL}/${encodeURIComponent(config.bankBin)}-${encodeURIComponent(config.accountNumber)}-${encodeURIComponent(config.template)}.png?${params.toString()}`,
    qrContent,
    expiresAt: resolvedExpiresAt.toISOString(),
    bankName: config.bankName,
    bankAccountNumber: config.accountNumber,
    bankAccountName: config.accountName
  };
}

export function getBankTransferExpiryDate(createdAt = new Date()) {
  return new Date(createdAt.getTime() + getBankTransferConfig().expiryMinutes * 60_000);
}

export function buildProviderReference(orderNo: string) {
  return `LG ${orderNo}`.replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function getBankTransferConfig() {
  const bankBin = process.env.COFFEE_POS_QR_BANK_BIN?.trim();
  const accountNumber = process.env.COFFEE_POS_QR_ACCOUNT_NUMBER?.trim();
  const accountName = process.env.COFFEE_POS_QR_ACCOUNT_NAME?.trim();

  if (!bankBin || !accountNumber || !accountName) {
    throw new PaymentQrConfigError("Bank transfer QR config is missing. Set COFFEE_POS_QR_BANK_BIN, COFFEE_POS_QR_ACCOUNT_NUMBER, and COFFEE_POS_QR_ACCOUNT_NAME.");
  }

  return {
    bankBin,
    accountNumber,
    accountName,
    bankName: process.env.COFFEE_POS_QR_BANK_NAME?.trim() || bankBin,
    template: process.env.COFFEE_POS_QR_TEMPLATE?.trim() || DEFAULT_QR_TEMPLATE,
    expiryMinutes: getPositiveInteger(process.env.COFFEE_POS_QR_EXPIRY_MINUTES, DEFAULT_QR_EXPIRY_MINUTES)
  };
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
