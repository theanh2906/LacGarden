import { Prisma } from "@prisma/client";
import { getDb } from "@/server/db";
import { inventoryReportQuerySchema, type InventoryReportQueryInput } from "@/server/inventory-validation";
import type {
  InventoryAlertState,
  InventoryImportBatchDto,
  InventoryMovementTypeSummaryDto,
  InventoryReportBucketDto,
  InventoryReportDto,
  InventoryReportGranularity,
  InventoryReportMode,
  InventoryReportPeriodDto,
  InventoryStockMovementDto,
  InventoryStockMovementType,
  InventoryStockOverviewRowDto,
  InventoryUploadDto
} from "@/types/inventory";

const RECENT_MOVEMENT_LIMIT = 16;
const LATEST_RECONCILIATION_LIMIT = 10;
const STALE_STOCK_DAYS = 30;

const movementLabels: Record<InventoryStockMovementType, string> = {
  PURCHASE: "Nhập mua",
  ADJUSTMENT: "Điều chỉnh",
  WASTE: "Hao hụt",
  CORRECTION: "Kiểm kho"
};

type InventoryReportMovement = Prisma.InventoryStockMovementGetPayload<{
  include: {
    inventoryItem: {
      select: {
        name: true;
        unit: true;
      };
    };
  };
}>;

type InventoryReportImportBatch = Prisma.InventoryImportBatchGetPayload<{
  include: {
    upload: true;
  };
}>;

export async function getInventoryReport(input: Partial<InventoryReportQueryInput> = {}): Promise<InventoryReportDto> {
  const filters = inventoryReportQuerySchema.parse(input);
  const period = resolveReportPeriod(filters);
  const db = getDb();

  const [items, periodMovements, recentMovements, latestMovementByItem, periodUploads, periodImportBatches, periodInvoiceAttachments] =
    await Promise.all([
      db.inventoryItem.findMany({
        orderBy: [{ isActive: "desc" }, { name: "asc" }]
      }),
      db.inventoryStockMovement.findMany({
        where: {
          createdAt: {
            gte: new Date(period.startDate),
            lt: new Date(period.endDate)
          }
        },
        include: {
          inventoryItem: {
            select: {
              name: true,
              unit: true
            }
          }
        },
        orderBy: { createdAt: "asc" }
      }),
      db.inventoryStockMovement.findMany({
        include: {
          inventoryItem: {
            select: {
              name: true,
              unit: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: RECENT_MOVEMENT_LIMIT
      }),
      db.inventoryStockMovement.groupBy({
        by: ["inventoryItemId"],
        _max: {
          createdAt: true
        }
      }),
      db.inventoryUpload.findMany({
        where: {
          createdAt: {
            gte: new Date(period.startDate),
            lt: new Date(period.endDate)
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      db.inventoryImportBatch.findMany({
        where: {
          createdAt: {
            gte: new Date(period.startDate),
            lt: new Date(period.endDate)
          }
        },
        include: {
          upload: true
        },
        orderBy: { createdAt: "desc" }
      }),
      db.inventoryInvoiceAttachment.findMany({
        where: {
          createdAt: {
            gte: new Date(period.startDate),
            lt: new Date(period.endDate)
          }
        }
      })
    ]);

  const lastMovementAtByItemId = new Map(latestMovementByItem.map((row) => [row.inventoryItemId, row._max.createdAt ?? null]));
  const stockOverview = items.map((item) => mapStockOverview(item, lastMovementAtByItemId.get(item.id) ?? null));
  const lowStockItems = stockOverview.filter((item) => item.alertState === "LOW_STOCK");
  const outOfStockItems = stockOverview.filter((item) => item.alertState === "OUT_OF_STOCK");
  const staleStockItems = stockOverview.filter((item) => item.staleDays !== null && item.staleDays >= STALE_STOCK_DAYS);
  const movementTypeBreakdown = buildMovementTypeBreakdown(periodMovements);
  const purchaseCostBuckets = buildBuckets(period, periodMovements.filter((movement) => movement.movementType === "PURCHASE"));
  const stockTrendBuckets = buildBuckets(period, periodMovements);
  const topChangedIngredients = buildTopChangedIngredients(periodMovements);
  const invoiceUploads = periodUploads.filter((upload) => upload.uploadType === "INVOICE");
  const attachedUploadIds = new Set(periodInvoiceAttachments.map((attachment) => attachment.uploadId));
  const attachedInvoiceCount = invoiceUploads.filter((upload) => upload.status === "ATTACHED" || attachedUploadIds.has(upload.id)).length;
  const importBatchCount = periodImportBatches.length;
  const confirmedImportBatchCount = periodImportBatches.filter((batch) => batch.status === "CONFIRMED").length;

  return {
    period,
    generatedAt: new Date().toISOString(),
    summary: {
      totalItems: stockOverview.length,
      activeItems: stockOverview.filter((item) => item.alertState !== "INACTIVE").length,
      lowStockItems: lowStockItems.length,
      outOfStockItems: outOfStockItems.length,
      staleStockItems: staleStockItems.length,
      totalPurchaseCostVnd: sum(periodMovements.filter((movement) => movement.movementType === "PURCHASE"), (movement) => toMoneyNumber(movement.totalCostVnd)),
      purchaseMovementCount: periodMovements.filter((movement) => movement.movementType === "PURCHASE").length,
      wasteMovementCount: periodMovements.filter((movement) => movement.movementType === "WASTE").length,
      adjustmentMovementCount: periodMovements.filter((movement) => movement.movementType === "ADJUSTMENT").length,
      correctionMovementCount: periodMovements.filter((movement) => movement.movementType === "CORRECTION").length,
      invoiceUploadCount: invoiceUploads.length,
      attachedInvoiceCount,
      importBatchCount,
      confirmedImportBatchCount
    },
    stockOverview,
    lowStockItems,
    outOfStockItems,
    staleStockItems,
    purchaseCostBuckets,
    stockTrendBuckets,
    movementTypeBreakdown,
    topChangedIngredients,
    recentMovements: recentMovements.map(mapMovement),
    reconciliation: {
      invoiceUploadCount: invoiceUploads.length,
      attachedInvoiceCount,
      unattachedInvoiceCount: Math.max(0, invoiceUploads.length - attachedInvoiceCount),
      importBatchCount,
      confirmedImportBatchCount,
      latestUploads: periodUploads.slice(0, LATEST_RECONCILIATION_LIMIT).map(mapUpload),
      latestImportBatches: periodImportBatches.slice(0, LATEST_RECONCILIATION_LIMIT).map(mapImportBatchSummary)
    }
  };
}

export function getEmptyInventoryReport(input: Partial<InventoryReportQueryInput> = {}): InventoryReportDto {
  const period = resolveReportPeriod(inventoryReportQuerySchema.parse(input));
  return {
    period,
    generatedAt: new Date().toISOString(),
    summary: {
      totalItems: 0,
      activeItems: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      staleStockItems: 0,
      totalPurchaseCostVnd: 0,
      purchaseMovementCount: 0,
      wasteMovementCount: 0,
      adjustmentMovementCount: 0,
      correctionMovementCount: 0,
      invoiceUploadCount: 0,
      attachedInvoiceCount: 0,
      importBatchCount: 0,
      confirmedImportBatchCount: 0
    },
    stockOverview: [],
    lowStockItems: [],
    outOfStockItems: [],
    staleStockItems: [],
    purchaseCostBuckets: buildBuckets(period, []),
    stockTrendBuckets: buildBuckets(period, []),
    movementTypeBreakdown: emptyMovementTypeBreakdown(),
    topChangedIngredients: [],
    recentMovements: [],
    reconciliation: {
      invoiceUploadCount: 0,
      attachedInvoiceCount: 0,
      unattachedInvoiceCount: 0,
      importBatchCount: 0,
      confirmedImportBatchCount: 0,
      latestUploads: [],
      latestImportBatches: []
    }
  };
}

export function parseInventoryReportSearchParams(searchParams: URLSearchParams): InventoryReportQueryInput {
  return inventoryReportQuerySchema.parse(Object.fromEntries(searchParams.entries()));
}

export function resolveReportPeriod(filters: InventoryReportQueryInput): InventoryReportPeriodDto {
  const now = new Date();
  if (filters.mode === "day") {
    const start = parseDateOnly(filters.date ?? toDateInputValue(now));
    const end = addDays(start, 1);
    return buildPeriod("day", formatDateLabel(start), start, end, "day");
  }

  if (filters.mode === "year") {
    const year = filters.year ?? now.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    return buildPeriod("year", year.toString(), start, end, "month");
  }

  if (filters.mode === "custom") {
    const start = parseDateOnly(filters.startDate ?? toDateInputValue(startOfMonth(now)));
    const inclusiveEnd = parseDateOnly(filters.endDate ?? toDateInputValue(now));
    const end = addDays(inclusiveEnd < start ? start : inclusiveEnd, 1);
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    return buildPeriod("custom", `${formatDateLabel(start)} - ${formatDateLabel(addDays(end, -1))}`, start, end, days > 62 ? "month" : "day");
  }

  const [year, month] = (filters.month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`)
    .split("-")
    .map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return buildPeriod("month", `${String(month).padStart(2, "0")}/${year}`, start, end, "day");
}

function buildPeriod(
  mode: InventoryReportMode,
  label: string,
  start: Date,
  end: Date,
  granularity: InventoryReportGranularity
): InventoryReportPeriodDto {
  return {
    mode,
    label,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    granularity
  };
}

function mapStockOverview(
  item: {
    id: string;
    name: string;
    code: string | null;
    unit: string;
    currentQuantity: Prisma.Decimal;
    lowStockThreshold: Prisma.Decimal;
    isActive: boolean;
  },
  lastMovementAt: Date | null
): InventoryStockOverviewRowDto {
  const currentQuantity = item.currentQuantity.toNumber();
  const lowStockThreshold = item.lowStockThreshold.toNumber();
  const staleDays = lastMovementAt ? Math.floor((Date.now() - lastMovementAt.getTime()) / 86400000) : null;
  return {
    id: item.id,
    name: item.name,
    code: item.code,
    unit: item.unit,
    currentQuantity,
    lowStockThreshold,
    alertState: getAlertState({ isActive: item.isActive, currentQuantity, lowStockThreshold }),
    lastMovementAt: lastMovementAt?.toISOString() ?? null,
    staleDays
  };
}

function buildBuckets(period: InventoryReportPeriodDto, movements: InventoryReportMovement[]): InventoryReportBucketDto[] {
  const buckets = createEmptyBuckets(period);
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const movement of movements) {
    const key = getBucketKey(movement.createdAt, period.granularity);
    const bucket = bucketByKey.get(key);
    if (!bucket) continue;
    bucket.movementCount += 1;
    bucket.netQuantityDelta += movement.quantityDelta.toNumber();
    bucket.totalCostVnd += toMoneyNumber(movement.totalCostVnd);
  }

  return buckets;
}

function buildMovementTypeBreakdown(movements: InventoryReportMovement[]): InventoryMovementTypeSummaryDto[] {
  const summaryByType = new Map<InventoryStockMovementType, InventoryMovementTypeSummaryDto>();
  for (const type of Object.keys(movementLabels) as InventoryStockMovementType[]) {
    summaryByType.set(type, {
      movementType: type,
      label: movementLabels[type],
      movementCount: 0,
      totalQuantityAbs: 0,
      totalCostVnd: 0
    });
  }

  for (const movement of movements) {
    const summary = summaryByType.get(movement.movementType);
    if (!summary) continue;
    summary.movementCount += 1;
    summary.totalQuantityAbs += Math.abs(movement.quantityDelta.toNumber());
    summary.totalCostVnd += toMoneyNumber(movement.totalCostVnd);
  }

  return Array.from(summaryByType.values());
}

function emptyMovementTypeBreakdown() {
  return buildMovementTypeBreakdown([]);
}

function buildTopChangedIngredients(movements: InventoryReportMovement[]) {
  const byItem = new Map<string, {
    inventoryItemId: string;
    itemName: string;
    unit: string;
    netQuantityDelta: number;
    totalQuantityChanged: number;
    purchaseQuantity: number;
    wasteQuantity: number;
    totalCostVnd: number;
    movementCount: number;
  }>();

  for (const movement of movements) {
    const quantityDelta = movement.quantityDelta.toNumber();
    const current =
      byItem.get(movement.inventoryItemId) ??
      {
        inventoryItemId: movement.inventoryItemId,
        itemName: movement.inventoryItem.name,
        unit: movement.inventoryItem.unit,
        netQuantityDelta: 0,
        totalQuantityChanged: 0,
        purchaseQuantity: 0,
        wasteQuantity: 0,
        totalCostVnd: 0,
        movementCount: 0
      };

    current.netQuantityDelta += quantityDelta;
    current.totalQuantityChanged += Math.abs(quantityDelta);
    if (movement.movementType === "PURCHASE") current.purchaseQuantity += Math.abs(quantityDelta);
    if (movement.movementType === "WASTE") current.wasteQuantity += Math.abs(quantityDelta);
    current.totalCostVnd += toMoneyNumber(movement.totalCostVnd);
    current.movementCount += 1;
    byItem.set(movement.inventoryItemId, current);
  }

  return Array.from(byItem.values()).sort((a, b) => b.totalQuantityChanged - a.totalQuantityChanged).slice(0, 8);
}

function createEmptyBuckets(period: InventoryReportPeriodDto): InventoryReportBucketDto[] {
  const buckets: InventoryReportBucketDto[] = [];
  let cursor = new Date(period.startDate);
  const end = new Date(period.endDate);

  while (cursor < end) {
    const key = getBucketKey(cursor, period.granularity);
    buckets.push({
      key,
      label: period.granularity === "month" ? `${String(cursor.getUTCMonth() + 1).padStart(2, "0")}/${cursor.getUTCFullYear()}` : `${String(cursor.getUTCDate()).padStart(2, "0")}/${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
      startDate: cursor.toISOString(),
      totalCostVnd: 0,
      movementCount: 0,
      netQuantityDelta: 0
    });
    cursor = period.granularity === "month" ? new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)) : addDays(cursor, 1);
  }

  return buckets;
}

function getBucketKey(date: Date, granularity: InventoryReportGranularity) {
  if (granularity === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return toDateInputValue(date);
}

function mapMovement(movement: InventoryReportMovement): InventoryStockMovementDto {
  return {
    id: movement.id,
    inventoryItemId: movement.inventoryItemId,
    itemName: movement.inventoryItem.name,
    movementType: movement.movementType,
    quantityDelta: movement.quantityDelta.toNumber(),
    quantityBefore: movement.quantityBefore.toNumber(),
    quantityAfter: movement.quantityAfter.toNumber(),
    purchaseDate: movement.purchaseDate?.toISOString() ?? null,
    unitCostVnd: toNullableMoneyNumber(movement.unitCostVnd),
    totalCostVnd: toNullableMoneyNumber(movement.totalCostVnd),
    note: movement.note,
    createdAt: movement.createdAt.toISOString()
  };
}

function mapImportBatchSummary(batch: InventoryReportImportBatch): Omit<InventoryImportBatchDto, "rows"> {
  return {
    id: batch.id,
    uploadId: batch.uploadId,
    upload: mapUpload(batch.upload),
    status: batch.status,
    sourceType: batch.sourceType,
    parserUsed: batch.parserUsed,
    rowCount: batch.rowCount,
    validRowCount: batch.validRowCount,
    invalidRowCount: batch.invalidRowCount,
    createdAt: batch.createdAt.toISOString(),
    confirmedAt: batch.confirmedAt?.toISOString() ?? null
  };
}

function mapUpload(upload: {
  id: string;
  originalFileName: string;
  storedFilePath: string;
  mimeType: string;
  fileSize: number;
  uploadType: "INVOICE" | "IMPORT";
  status: "STORED" | "PARSED" | "ATTACHED" | "FAILED";
  createdAt: Date;
}): InventoryUploadDto {
  return {
    id: upload.id,
    originalFileName: upload.originalFileName,
    storedFilePath: upload.storedFilePath,
    mimeType: upload.mimeType,
    fileSize: upload.fileSize,
    uploadType: upload.uploadType,
    status: upload.status,
    createdAt: upload.createdAt.toISOString()
  };
}

function getAlertState({
  isActive,
  currentQuantity,
  lowStockThreshold
}: {
  isActive: boolean;
  currentQuantity: number;
  lowStockThreshold: number;
}): InventoryAlertState {
  if (!isActive) return "INACTIVE";
  if (lowStockThreshold <= 0) return "OK";
  if (currentQuantity <= 0) return "OUT_OF_STOCK";
  if (currentQuantity <= lowStockThreshold) return "LOW_STOCK";
  return "OK";
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateInputValue(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatDateLabel(date: Date) {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function sum<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function toMoneyNumber(value: bigint | number | null) {
  if (value === null) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}

function toNullableMoneyNumber(value: bigint | number | null) {
  if (value === null) return null;
  return toMoneyNumber(value);
}
