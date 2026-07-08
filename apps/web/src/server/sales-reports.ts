import { Prisma } from "@prisma/client";
import { getDb } from "@/server/db";
import { salesReportQuerySchema, type SalesReportQueryInput } from "@/server/sales-reports-validation";
import type {
  PaymentMethodSplitDto,
  PaymentReconciliationRowDto,
  ProductPerformanceRowDto,
  SalesAnalyticsReportDto,
  SalesReportBucketDto,
  SalesReportGranularity,
  SalesReportMode,
  SalesReportPeriodDto,
  SlowMoverRowDto
} from "@/types/sales-reports";

const TIME_ZONE = "Asia/Bangkok";
const DEFAULT_TAX_RATE_PERCENT = 0;
const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "QR", "CARD", "OTHER"] as const;
const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID", "REFUNDED"] as const;

type ReportOrder = Prisma.OrderGetPayload<{
  include: {
    payments: true;
    items: {
      include: {
        costSnapshot: true;
      };
    };
  };
}>;

type ReportPayment = Prisma.PaymentGetPayload<Record<string, never>>;

type ActiveVariant = Prisma.MenuItemVariantGetPayload<{
  include: {
    item: true;
  };
}>;

export async function getSalesAnalyticsReport(input: Partial<SalesReportQueryInput> = {}): Promise<SalesAnalyticsReportDto> {
  const filters = salesReportQuerySchema.parse(input);
  const period = resolveSalesReportPeriod(filters);
  const db = getDb();
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);

  const [orders, payments, activeVariants] = await Promise.all([
    db.order.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        status: { not: "CANCELLED" }
      },
      include: {
        payments: true,
        items: {
          include: {
            costSnapshot: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    }),
    db.payment.findMany({
      where: {
        createdAt: { gte: start, lt: end }
      },
      orderBy: { createdAt: "asc" }
    }),
    db.menuItemVariant.findMany({
      where: {
        isActive: true,
        item: {
          isActive: true,
          category: { isActive: true }
        }
      },
      include: {
        item: true
      },
      orderBy: [{ item: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
    })
  ]);

  return buildSalesReport({ period, orders, payments, activeVariants });
}

export function getEmptySalesAnalyticsReport(input: Partial<SalesReportQueryInput> = {}): SalesAnalyticsReportDto {
  const period = resolveSalesReportPeriod(salesReportQuerySchema.parse(input));
  return buildSalesReport({ period, orders: [], payments: [], activeVariants: [] });
}

export function parseSalesReportSearchParams(searchParams: URLSearchParams): SalesReportQueryInput {
  return salesReportQuerySchema.parse(Object.fromEntries(searchParams.entries()));
}

export function resolveSalesReportPeriod(filters: SalesReportQueryInput): SalesReportPeriodDto {
  const now = new Date();
  if (filters.mode === "day") {
    const start = bangkokDateStart(filters.date ?? toBangkokDateInputValue(now));
    const end = addBangkokDays(start, 1);
    return buildPeriod("day", formatDateLabel(start), start, end, "day");
  }

  if (filters.mode === "week") {
    const start = filters.week ? isoWeekStart(filters.week) : startOfBangkokWeek(now);
    const end = addBangkokDays(start, 7);
    return buildPeriod("week", `Week ${getIsoWeekKey(start)}`, start, end, "day");
  }

  if (filters.mode === "custom") {
    const start = bangkokDateStart(filters.startDate ?? toBangkokDateInputValue(startOfBangkokMonth(now)));
    const inclusiveEnd = bangkokDateStart(filters.endDate ?? toBangkokDateInputValue(now));
    const end = addBangkokDays(inclusiveEnd < start ? start : inclusiveEnd, 1);
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    return buildPeriod("custom", `${formatDateLabel(start)} - ${formatDateLabel(addBangkokDays(end, -1))}`, start, end, days > 120 ? "month" : days > 45 ? "week" : "day");
  }

  const [year, month] = (filters.month ?? `${getBangkokParts(now).year}-${String(getBangkokParts(now).month).padStart(2, "0")}`)
    .split("-")
    .map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, -7, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, -7, 0, 0, 0));
  return buildPeriod("month", `${String(month).padStart(2, "0")}/${year}`, start, end, "day");
}

function buildSalesReport({
  period,
  orders,
  payments,
  activeVariants
}: {
  period: SalesReportPeriodDto;
  orders: ReportOrder[];
  payments: ReportPayment[];
  activeVariants: ActiveVariant[];
}): SalesAnalyticsReportDto {
  const confirmedPayments = payments.filter((payment) => payment.status === "CONFIRMED");
  const pendingPayments = payments.filter((payment) => payment.status === "PENDING");
  const salesRevenueVnd = sum(confirmedPayments, (payment) => toNumber(payment.paidAmount ?? payment.amount));
  const orderCount = orders.length;
  const paidOrderCount = orders.filter((order) => order.paymentStatus === "PAID").length;
  const discountTotalVnd = sum(orders, (order) => toNumber(order.discountTotal));
  const productPerformance = buildProductPerformance(orders);
  const productRevenue = sum(productPerformance, (row) => row.revenueVnd);
  const grossMarginVnd = sum(productPerformance, (row) => row.grossMarginVnd);
  const revenueBuckets = buildRevenueBuckets(period, orders, confirmedPayments);
  const paymentMethodSplit = buildPaymentMethodSplit(payments, salesRevenueVnd);
  const taxRatePercent = getTaxRatePercent();
  const taxableRevenueVnd = salesRevenueVnd;
  const taxAmountVnd = calculateInclusiveTaxAmount(taxableRevenueVnd, taxRatePercent);
  const orderTotalVnd = sum(orders, (order) => toNumber(order.total));
  const pendingPaymentVnd = sum(pendingPayments, (payment) => toNumber(payment.amount));

  const sortedByQuantity = [...productPerformance].sort((a, b) => b.quantitySold - a.quantitySold || b.revenueVnd - a.revenueVnd);
  const sortedByRevenue = [...productPerformance].sort((a, b) => b.revenueVnd - a.revenueVnd || b.quantitySold - a.quantitySold);

  return {
    period,
    generatedAt: new Date().toISOString(),
    summary: {
      salesRevenueVnd,
      orderCount,
      paidOrderCount,
      averageOrderValueVnd: orderCount ? Math.round(salesRevenueVnd / orderCount) : 0,
      discountTotalVnd,
      serviceChargeVnd: 0,
      grossMarginVnd,
      grossMarginPercent: productRevenue ? roundPercent((grossMarginVnd / productRevenue) * 100) : 0
    },
    revenueBuckets,
    paymentMethodSplit,
    favoriteItems: sortedByQuantity.slice(0, 8),
    bestSellers: sortedByRevenue.slice(0, 12),
    slowMovers: buildSlowMovers(activeVariants, productPerformance),
    productPerformance,
    taxReport: {
      taxRatePercent,
      taxableRevenueVnd,
      taxAmountVnd,
      discountsVnd: discountTotalVnd,
      serviceChargeVnd: 0,
      confirmedPaymentVnd: salesRevenueVnd,
      pendingPaymentVnd,
      paymentDifferenceVnd: salesRevenueVnd - orderTotalVnd,
      reconciliationByOrderStatus: buildOrderPaymentStatusReconciliation(orders)
    }
  };
}

function buildProductPerformance(orders: ReportOrder[]): ProductPerformanceRowDto[] {
  const byProduct = new Map<string, ProductPerformanceRowDto & { soldAtValues: string[] }>();

  for (const order of orders) {
    for (const item of order.items) {
      if (item.status === "CANCELLED") continue;
      const key = item.variantId ?? item.menuItemId ?? item.itemNameSnapshot;
      const revenueVnd = toNumber(item.lineTotal);
      const unitCostVnd = item.costSnapshot ? toNumber(item.costSnapshot.totalCostVnd) : 0;
      const costVnd = unitCostVnd * item.quantity;
      const current =
        byProduct.get(key) ??
        {
          key,
          menuItemId: item.menuItemId,
          variantId: item.variantId,
          name: item.itemNameSnapshot,
          variantName: item.variantNameSnapshot,
          quantitySold: 0,
          revenueVnd: 0,
          revenueContributionPercent: 0,
          costVnd: 0,
          grossMarginVnd: 0,
          grossMarginPercent: 0,
          orderCount: 0,
          missingCostSnapshotCount: 0,
          soldAtValues: []
        };

      current.quantitySold += item.quantity;
      current.revenueVnd += revenueVnd;
      current.costVnd += costVnd;
      current.grossMarginVnd += revenueVnd - costVnd;
      current.orderCount += 1;
      current.soldAtValues.push(order.createdAt.toISOString());
      if (!item.costSnapshot) current.missingCostSnapshotCount += 1;
      byProduct.set(key, current);
    }
  }

  const rows = Array.from(byProduct.values());
  const totalRevenue = sum(rows, (row) => row.revenueVnd);
  return rows
    .map(({ soldAtValues: _soldAtValues, ...row }) => ({
      ...row,
      revenueContributionPercent: totalRevenue ? roundPercent((row.revenueVnd / totalRevenue) * 100) : 0,
      grossMarginPercent: row.revenueVnd ? roundPercent((row.grossMarginVnd / row.revenueVnd) * 100) : 0
    }))
    .sort((a, b) => b.revenueVnd - a.revenueVnd);
}

function buildSlowMovers(activeVariants: ActiveVariant[], productPerformance: ProductPerformanceRowDto[]): SlowMoverRowDto[] {
  const performanceByVariantId = new Map(productPerformance.filter((row) => row.variantId).map((row) => [row.variantId as string, row]));
  return activeVariants
    .map((variant) => {
      const performance = performanceByVariantId.get(variant.id);
      return {
        key: variant.id,
        name: variant.item.name,
        variantName: variant.name,
        quantitySold: performance?.quantitySold ?? 0,
        revenueVnd: performance?.revenueVnd ?? 0,
        lastSoldAt: null
      };
    })
    .sort((a, b) => a.quantitySold - b.quantitySold || a.revenueVnd - b.revenueVnd || a.name.localeCompare(b.name))
    .slice(0, 12);
}

function buildPaymentMethodSplit(payments: ReportPayment[], totalConfirmedAmount: number): PaymentMethodSplitDto[] {
  return PAYMENT_METHODS.map((method) => {
    const methodPayments = payments.filter((payment) => payment.method === method);
    const confirmedAmountVnd = sum(methodPayments.filter((payment) => payment.status === "CONFIRMED"), (payment) =>
      toNumber(payment.paidAmount ?? payment.amount)
    );
    const pendingAmountVnd = sum(methodPayments.filter((payment) => payment.status === "PENDING"), (payment) => toNumber(payment.amount));
    const refundedAmountVnd = sum(methodPayments.filter((payment) => payment.status === "REFUNDED"), (payment) => toNumber(payment.amount));
    return {
      method,
      confirmedAmountVnd,
      pendingAmountVnd,
      refundedAmountVnd,
      paymentCount: methodPayments.length,
      confirmedPercent: totalConfirmedAmount ? Math.round((confirmedAmountVnd / totalConfirmedAmount) * 100) : 0
    };
  });
}

function buildRevenueBuckets(period: SalesReportPeriodDto, orders: ReportOrder[], confirmedPayments: ReportPayment[]): SalesReportBucketDto[] {
  const buckets = createEmptyBuckets(period);
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const payment of confirmedPayments) {
    const bucket = bucketByKey.get(getBucketKey(payment.createdAt, period.granularity));
    if (bucket) bucket.revenueVnd += toNumber(payment.paidAmount ?? payment.amount);
  }

  for (const order of orders) {
    const bucket = bucketByKey.get(getBucketKey(order.createdAt, period.granularity));
    if (bucket) bucket.orderCount += 1;
  }

  return buckets.map((bucket) => ({
    ...bucket,
    averageOrderValueVnd: bucket.orderCount ? Math.round(bucket.revenueVnd / bucket.orderCount) : 0
  }));
}

function buildOrderPaymentStatusReconciliation(orders: ReportOrder[]): PaymentReconciliationRowDto[] {
  return PAYMENT_STATUSES.map((paymentStatus) => {
    const rows = orders.filter((order) => order.paymentStatus === paymentStatus);
    return {
      paymentStatus,
      orderCount: rows.length,
      orderTotalVnd: sum(rows, (order) => toNumber(order.total))
    };
  });
}

function createEmptyBuckets(period: SalesReportPeriodDto): SalesReportBucketDto[] {
  const buckets: SalesReportBucketDto[] = [];
  let cursor = new Date(period.startDate);
  const end = new Date(period.endDate);

  while (cursor < end) {
    buckets.push({
      key: getBucketKey(cursor, period.granularity),
      label: getBucketLabel(cursor, period.granularity),
      startDate: cursor.toISOString(),
      revenueVnd: 0,
      orderCount: 0,
      averageOrderValueVnd: 0
    });
    cursor =
      period.granularity === "month"
        ? new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, -7, 0, 0, 0))
        : addBangkokDays(cursor, period.granularity === "week" ? 7 : 1);
  }

  return buckets;
}

function buildPeriod(
  mode: SalesReportMode,
  label: string,
  start: Date,
  end: Date,
  granularity: SalesReportGranularity
): SalesReportPeriodDto {
  return {
    mode,
    label,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    granularity
  };
}

function getBucketKey(date: Date, granularity: SalesReportGranularity) {
  if (granularity === "month") {
    const parts = getBangkokParts(date);
    return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
  }
  if (granularity === "week") return getIsoWeekKey(date);
  return toBangkokDateInputValue(date);
}

function getBucketLabel(date: Date, granularity: SalesReportGranularity) {
  const parts = getBangkokParts(date);
  if (granularity === "month") return `${String(parts.month).padStart(2, "0")}/${parts.year}`;
  if (granularity === "week") return getIsoWeekKey(date).replace("-", " ");
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}`;
}

function getTaxRatePercent() {
  const parsed = Number(process.env.COFFEE_POS_TAX_RATE_PERCENT ?? DEFAULT_TAX_RATE_PERCENT);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_TAX_RATE_PERCENT;
}

function calculateInclusiveTaxAmount(taxableRevenueVnd: number, taxRatePercent: number) {
  if (taxRatePercent <= 0) return 0;
  return Math.round(taxableRevenueVnd * (taxRatePercent / (100 + taxRatePercent)));
}

function bangkokDateStart(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0));
}

function addBangkokDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days, date.getUTCHours(), 0, 0, 0));
}

function startOfBangkokMonth(date: Date) {
  const parts = getBangkokParts(date);
  return new Date(Date.UTC(parts.year, parts.month - 1, 1, -7, 0, 0, 0));
}

function startOfBangkokWeek(date: Date) {
  const parts = getBangkokParts(date);
  const start = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, -7, 0, 0, 0));
  const day = start.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addBangkokDays(start, mondayOffset);
}

function isoWeekStart(value: string) {
  const [yearPart, weekPart] = value.split("-W");
  const year = Number(yearPart);
  const week = Number(weekPart);
  const jan4 = new Date(Date.UTC(year, 0, 4, -7, 0, 0, 0));
  const weekOneStart = startOfBangkokWeek(jan4);
  return addBangkokDays(weekOneStart, (week - 1) * 7);
}

function getIsoWeekKey(date: Date) {
  const localStart = bangkokDateStart(toBangkokDateInputValue(date));
  const thursday = addBangkokDays(startOfBangkokWeek(localStart), 3);
  const weekYear = getBangkokParts(thursday).year;
  const weekOneStart = isoWeekStart(`${weekYear}-W01`);
  const week = Math.floor((startOfBangkokWeek(localStart).getTime() - weekOneStart.getTime()) / 604800000) + 1;
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function getBangkokParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

function toBangkokDateInputValue(date: Date) {
  const parts = getBangkokParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function formatDateLabel(date: Date) {
  const parts = getBangkokParts(date);
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`;
}

function sum<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function toNumber(value: bigint | number | Prisma.Decimal | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return value.toNumber();
}
