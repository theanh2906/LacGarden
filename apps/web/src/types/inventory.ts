export type InventoryStockMovementType = "PURCHASE" | "ADJUSTMENT" | "WASTE" | "CORRECTION";
export type InventoryStatusFilter = "all" | "active" | "low-stock" | "out-of-stock" | "inactive";
export type InventoryAlertState = "OK" | "LOW_STOCK" | "OUT_OF_STOCK" | "INACTIVE";

export type InventoryItemDto = {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  currentQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  note: string | null;
  alertState: InventoryAlertState;
  movementCount: number;
  createdAt: string;
  updatedAt: string;
};

export type InventoryStockMovementDto = {
  id: string;
  inventoryItemId: string;
  itemName: string;
  movementType: InventoryStockMovementType;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  purchaseDate: string | null;
  unitCostVnd: number | null;
  totalCostVnd: number | null;
  note: string | null;
  createdAt: string;
};

export type InventorySummaryDto = {
  totalItems: number;
  activeItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  inactiveItems: number;
  stockValueVnd: number;
};

export type InventoryAdminSnapshot = {
  items: InventoryItemDto[];
  recentMovements: InventoryStockMovementDto[];
  summary: InventorySummaryDto;
};

export type InventoryUploadType = "INVOICE" | "IMPORT";
export type InventoryUploadStatus = "STORED" | "PARSED" | "ATTACHED" | "FAILED";
export type InventoryImportBatchStatus = "DRAFT" | "PARSED" | "CONFIRMED" | "FAILED";
export type InventoryImportSourceType = "TXT" | "EXCEL" | "UNKNOWN";
export type InventoryImportParserUsed = "DETERMINISTIC" | "GEMINI" | "MIXED";
export type InventoryImportRowStatus = "VALID" | "INVALID" | "WARNING" | "CONFIRMED" | "SKIPPED";

export type InventoryUploadDto = {
  id: string;
  originalFileName: string;
  storedFilePath: string;
  mimeType: string;
  fileSize: number;
  uploadType: InventoryUploadType;
  status: InventoryUploadStatus;
  createdAt: string;
};

export type InventoryImportRowDto = {
  id: string;
  batchId: string;
  rowIndex: number;
  rawText: string | null;
  parsedJson: Record<string, unknown>;
  normalizedName: string;
  unit: string | null;
  quantity: number | null;
  unitCostVnd: number | null;
  totalCostVnd: number | null;
  purchaseDate: string | null;
  validationStatus: InventoryImportRowStatus;
  validationErrors: string[];
  matchedInventoryItemId: string | null;
  matchedInventoryItemName: string | null;
  createdAt: string;
};

export type InventoryImportBatchDto = {
  id: string;
  uploadId: string;
  upload: InventoryUploadDto;
  status: InventoryImportBatchStatus;
  sourceType: InventoryImportSourceType;
  parserUsed: InventoryImportParserUsed;
  rowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  createdAt: string;
  confirmedAt: string | null;
  rows: InventoryImportRowDto[];
};

export type InventoryImportConfirmResultDto = {
  batch: InventoryImportBatchDto;
  createdItemCount: number;
  movementCount: number;
  skippedRowCount: number;
};

export type InventoryReportMode = "day" | "month" | "year" | "custom";
export type InventoryReportGranularity = "day" | "month";

export type InventoryReportPeriodDto = {
  mode: InventoryReportMode;
  label: string;
  startDate: string;
  endDate: string;
  granularity: InventoryReportGranularity;
};

export type InventoryReportSummaryDto = {
  totalItems: number;
  activeItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  staleStockItems: number;
  totalPurchaseCostVnd: number;
  purchaseMovementCount: number;
  wasteMovementCount: number;
  adjustmentMovementCount: number;
  correctionMovementCount: number;
  invoiceUploadCount: number;
  attachedInvoiceCount: number;
  importBatchCount: number;
  confirmedImportBatchCount: number;
};

export type InventoryStockOverviewRowDto = {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  currentQuantity: number;
  lowStockThreshold: number;
  alertState: InventoryAlertState;
  lastMovementAt: string | null;
  staleDays: number | null;
};

export type InventoryReportBucketDto = {
  key: string;
  label: string;
  startDate: string;
  totalCostVnd: number;
  movementCount: number;
  netQuantityDelta: number;
};

export type InventoryMovementTypeSummaryDto = {
  movementType: InventoryStockMovementType;
  label: string;
  movementCount: number;
  totalQuantityAbs: number;
  totalCostVnd: number;
};

export type InventoryIngredientChangeDto = {
  inventoryItemId: string;
  itemName: string;
  unit: string;
  netQuantityDelta: number;
  totalQuantityChanged: number;
  purchaseQuantity: number;
  wasteQuantity: number;
  totalCostVnd: number;
  movementCount: number;
};

export type InventoryReconciliationSummaryDto = {
  invoiceUploadCount: number;
  attachedInvoiceCount: number;
  unattachedInvoiceCount: number;
  importBatchCount: number;
  confirmedImportBatchCount: number;
  latestUploads: InventoryUploadDto[];
  latestImportBatches: Array<Omit<InventoryImportBatchDto, "rows">>;
};

export type InventoryReportDto = {
  period: InventoryReportPeriodDto;
  generatedAt: string;
  summary: InventoryReportSummaryDto;
  stockOverview: InventoryStockOverviewRowDto[];
  lowStockItems: InventoryStockOverviewRowDto[];
  outOfStockItems: InventoryStockOverviewRowDto[];
  staleStockItems: InventoryStockOverviewRowDto[];
  purchaseCostBuckets: InventoryReportBucketDto[];
  stockTrendBuckets: InventoryReportBucketDto[];
  movementTypeBreakdown: InventoryMovementTypeSummaryDto[];
  topChangedIngredients: InventoryIngredientChangeDto[];
  recentMovements: InventoryStockMovementDto[];
  reconciliation: InventoryReconciliationSummaryDto;
};
