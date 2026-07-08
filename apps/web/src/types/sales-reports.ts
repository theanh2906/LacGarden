import type { PaymentMethod, PaymentStatus } from "@/types/pos";

export type SalesReportMode = "day" | "week" | "month" | "custom";
export type SalesReportGranularity = "day" | "week" | "month";

export type SalesReportPeriodDto = {
  mode: SalesReportMode;
  label: string;
  startDate: string;
  endDate: string;
  granularity: SalesReportGranularity;
};

export type SalesReportBucketDto = {
  key: string;
  label: string;
  startDate: string;
  revenueVnd: number;
  orderCount: number;
  averageOrderValueVnd: number;
};

export type PaymentMethodSplitDto = {
  method: PaymentMethod;
  confirmedAmountVnd: number;
  pendingAmountVnd: number;
  refundedAmountVnd: number;
  paymentCount: number;
  confirmedPercent: number;
};

export type ProductPerformanceRowDto = {
  key: string;
  menuItemId: string | null;
  variantId: string | null;
  name: string;
  variantName: string | null;
  quantitySold: number;
  revenueVnd: number;
  revenueContributionPercent: number;
  costVnd: number;
  grossMarginVnd: number;
  grossMarginPercent: number;
  orderCount: number;
  missingCostSnapshotCount: number;
};

export type SlowMoverRowDto = {
  key: string;
  name: string;
  variantName: string | null;
  quantitySold: number;
  revenueVnd: number;
  lastSoldAt: string | null;
};

export type PaymentReconciliationRowDto = {
  paymentStatus: PaymentStatus;
  orderCount: number;
  orderTotalVnd: number;
};

export type TaxReportDto = {
  taxRatePercent: number;
  taxableRevenueVnd: number;
  taxAmountVnd: number;
  discountsVnd: number;
  serviceChargeVnd: number;
  confirmedPaymentVnd: number;
  pendingPaymentVnd: number;
  paymentDifferenceVnd: number;
  reconciliationByOrderStatus: PaymentReconciliationRowDto[];
};

export type SalesReportSummaryDto = {
  salesRevenueVnd: number;
  orderCount: number;
  paidOrderCount: number;
  averageOrderValueVnd: number;
  discountTotalVnd: number;
  serviceChargeVnd: number;
  grossMarginVnd: number;
  grossMarginPercent: number;
};

export type SalesAnalyticsReportDto = {
  period: SalesReportPeriodDto;
  generatedAt: string;
  summary: SalesReportSummaryDto;
  revenueBuckets: SalesReportBucketDto[];
  paymentMethodSplit: PaymentMethodSplitDto[];
  favoriteItems: ProductPerformanceRowDto[];
  bestSellers: ProductPerformanceRowDto[];
  slowMovers: SlowMoverRowDto[];
  productPerformance: ProductPerformanceRowDto[];
  taxReport: TaxReportDto;
};
