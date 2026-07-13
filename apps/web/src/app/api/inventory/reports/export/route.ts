import * as XLSX from "xlsx";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { inventoryReportExportQuerySchema } from "@/server/inventory-validation";
import { getEmptyInventoryReport, getInventoryReport, parseInventoryReportSearchParams } from "@/server/inventory-reports";
import type { InventoryReportDto } from "@/types/inventory";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireStaffPermission("reports:view");
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
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.info("[inventory-api] Inventory report export failed", error);
    return Response.json(
      { error: { code: "INVENTORY_REPORT_EXPORT_ERROR", message: "Không thể xuất báo cáo kho. Kiểm tra nhật ký quản trị để biết chi tiết." } },
      { status: 400 }
    );
  }
}

function buildCsv(report: InventoryReportDto) {
  const rows: string[][] = [];
  addSection(rows, "Kỳ báo cáo", [
    ["Chế độ", report.period.mode],
    ["Nhãn", report.period.label],
    ["Bắt đầu", report.period.startDate],
    ["Kết thúc", report.period.endDate],
    ["Tạo lúc", report.generatedAt]
  ]);
  addSection(rows, "Tổng quan", Object.entries(report.summary).map(([key, value]) => [key, String(value)]));
  addSection(rows, "Tồn kho thấp", report.lowStockItems.map((item) => [item.name, item.unit, String(item.currentQuantity), String(item.lowStockThreshold), item.alertState]));
  addSection(rows, "Hết hàng", report.outOfStockItems.map((item) => [item.name, item.unit, String(item.currentQuantity), String(item.lowStockThreshold), item.alertState]));
  addSection(
    rows,
    "Nhóm chi phí mua hàng",
    report.purchaseCostBuckets.map((bucket) => [bucket.label, String(bucket.totalCostVnd), String(bucket.movementCount), String(bucket.netQuantityDelta)])
  );
  addSection(
    rows,
    "Phân loại biến động",
    report.movementTypeBreakdown.map((row) => [row.movementType, row.label, String(row.movementCount), String(row.totalQuantityAbs), String(row.totalCostVnd)])
  );
  addSection(
    rows,
    "Nguyên liệu biến động nhiều",
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
    "Biến động gần đây",
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
    "Tệp đã tải lên",
    report.reconciliation.latestUploads.map((upload) => [upload.createdAt, upload.originalFileName, upload.uploadType, upload.status, String(upload.fileSize)])
  );
  addSection(
    rows,
    "Lô nhập dữ liệu",
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
    "Tổng quan"
  );
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.stockOverview), "Tồn kho");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.lowStockItems), "Tồn kho thấp");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.purchaseCostBuckets), "Chi phí mua");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.stockTrendBuckets), "Xu hướng tồn kho");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.movementTypeBreakdown), "Loại biến động");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.topChangedIngredients), "Biến động nhiều");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.recentMovements), "Biến động");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.reconciliation.latestUploads), "Tệp tải lên");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.reconciliation.latestImportBatches), "Lô nhập");
  return workbook;
}

function addSection(rows: string[][], title: string, sectionRows: string[][]) {
  rows.push([], [title]);
  rows.push(...sectionRows);
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
