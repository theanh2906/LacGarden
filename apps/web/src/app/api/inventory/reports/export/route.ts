import * as XLSX from "xlsx";
import { inventoryReportExportQuerySchema } from "@/server/inventory-validation";
import { getEmptyInventoryReport, getInventoryReport, parseInventoryReportSearchParams } from "@/server/inventory-reports";
import type { InventoryReportDto } from "@/types/inventory";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = inventoryReportExportQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const reportQuery = parseInventoryReportSearchParams(url.searchParams);
    const report = await getInventoryReport(reportQuery).catch((error) => {
      console.info("[inventory-api] Inventory report export data load failed", error);
      return getEmptyInventoryReport(reportQuery);
    });
    const filenameBase = `inventory-report-${report.period.mode}-${report.period.startDate.slice(0, 10)}-${report.period.endDate.slice(0, 10)}`;

    if (query.format === "xlsx") {
      const workbook = buildWorkbook(report);
      const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`
        }
      });
    }

    return new Response(`\uFEFF${buildCsv(report)}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`
      }
    });
  } catch (error) {
    console.info("[inventory-api] Inventory report export failed", error);
    return Response.json(
      { error: { code: "INVENTORY_REPORT_EXPORT_ERROR", message: "Unable to export inventory report. Check admin logs for details." } },
      { status: 400 }
    );
  }
}

function buildCsv(report: InventoryReportDto) {
  const rows: string[][] = [];
  addSection(rows, "Report period", [
    ["Mode", report.period.mode],
    ["Label", report.period.label],
    ["Start", report.period.startDate],
    ["End", report.period.endDate],
    ["Generated at", report.generatedAt]
  ]);
  addSection(rows, "Summary", Object.entries(report.summary).map(([key, value]) => [key, String(value)]));
  addSection(rows, "Low stock", report.lowStockItems.map((item) => [item.name, item.unit, String(item.currentQuantity), String(item.lowStockThreshold), item.alertState]));
  addSection(rows, "Out of stock", report.outOfStockItems.map((item) => [item.name, item.unit, String(item.currentQuantity), String(item.lowStockThreshold), item.alertState]));
  addSection(
    rows,
    "Purchase cost buckets",
    report.purchaseCostBuckets.map((bucket) => [bucket.label, String(bucket.totalCostVnd), String(bucket.movementCount), String(bucket.netQuantityDelta)])
  );
  addSection(
    rows,
    "Movement type breakdown",
    report.movementTypeBreakdown.map((row) => [row.movementType, row.label, String(row.movementCount), String(row.totalQuantityAbs), String(row.totalCostVnd)])
  );
  addSection(
    rows,
    "Top changed ingredients",
    report.topChangedIngredients.map((row) => [
      row.itemName,
      row.unit,
      String(row.netQuantityDelta),
      String(row.totalQuantityChanged),
      String(row.purchaseQuantity),
      String(row.wasteQuantity),
      String(row.totalCostVnd),
      String(row.movementCount)
    ])
  );
  addSection(
    rows,
    "Recent movements",
    report.recentMovements.map((movement) => [
      movement.createdAt,
      movement.itemName,
      movement.movementType,
      String(movement.quantityDelta),
      String(movement.quantityBefore),
      String(movement.quantityAfter),
      String(movement.totalCostVnd ?? ""),
      movement.note ?? ""
    ])
  );
  addSection(
    rows,
    "Uploads",
    report.reconciliation.latestUploads.map((upload) => [upload.createdAt, upload.originalFileName, upload.uploadType, upload.status, String(upload.fileSize)])
  );
  addSection(
    rows,
    "Import batches",
    report.reconciliation.latestImportBatches.map((batch) => [
      batch.createdAt,
      batch.upload.originalFileName,
      batch.status,
      batch.sourceType,
      batch.parserUsed,
      String(batch.rowCount),
      String(batch.validRowCount),
      String(batch.invalidRowCount)
    ])
  );

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function buildWorkbook(report: InventoryReportDto) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      {
        mode: report.period.mode,
        label: report.period.label,
        startDate: report.period.startDate,
        endDate: report.period.endDate,
        generatedAt: report.generatedAt,
        ...report.summary
      }
    ]),
    "Summary"
  );
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.stockOverview), "Stock");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.lowStockItems), "Low stock");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.purchaseCostBuckets), "Purchase cost");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.stockTrendBuckets), "Stock trend");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.movementTypeBreakdown), "Movement types");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.topChangedIngredients), "Top changed");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.recentMovements), "Movements");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.reconciliation.latestUploads), "Uploads");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.reconciliation.latestImportBatches), "Imports");
  return workbook;
}

function addSection(rows: string[][], title: string, sectionRows: string[][]) {
  rows.push([], [title]);
  rows.push(...sectionRows);
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
