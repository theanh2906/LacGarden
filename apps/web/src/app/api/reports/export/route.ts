import * as XLSX from "xlsx";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { getEmptySalesAnalyticsReport, getSalesAnalyticsReport, parseSalesReportSearchParams } from "@/server/sales-reports";
import { salesReportExportQuerySchema } from "@/server/sales-reports-validation";
import type { SalesAnalyticsReportDto } from "@/types/sales-reports";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireStaffPermission("reports:view");
    const url = new URL(request.url);
    const query = salesReportExportQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const reportQuery = parseSalesReportSearchParams(url.searchParams);
    const report = await getSalesAnalyticsReport(reportQuery).catch((error) => {
      console.info("[sales-reports-api] Export data load failed", error);
      return getEmptySalesAnalyticsReport(reportQuery);
    });
    const filenameBase = `sales-report-${report.period.mode}-${report.period.startDate.slice(0, 10)}-${report.period.endDate.slice(0, 10)}`;

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

    if (query.format === "pdf") {
      const bytes = buildSimplePdf(report);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`
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

    console.info("[sales-reports-api] Sales report export failed", error);
    return Response.json(
      { error: { code: "SALES_REPORT_EXPORT_ERROR", message: "Không thể xuất báo cáo bán hàng. Kiểm tra nhật ký quản trị để biết chi tiết." } },
      { status: 400 }
    );
  }
}

function buildCsv(report: SalesAnalyticsReportDto) {
  const rows: string[][] = [];
  addSection(rows, "Report period", [
    ["Mode", report.period.mode],
    ["Label", report.period.label],
    ["Start", report.period.startDate],
    ["End", report.period.endDate],
    ["Generated at", report.generatedAt]
  ]);
  addSection(rows, "Summary", Object.entries(report.summary).map(([key, value]) => [key, String(value)]));
  addSection(
    rows,
    "Revenue buckets",
    report.revenueBuckets.map((bucket) => [bucket.label, String(bucket.revenueVnd), String(bucket.orderCount), String(bucket.averageOrderValueVnd)])
  );
  addSection(
    rows,
    "Payment method split",
    report.paymentMethodSplit.map((row) => [
      row.method,
      String(row.confirmedAmountVnd),
      String(row.pendingAmountVnd),
      String(row.refundedAmountVnd),
      String(row.paymentCount),
      String(row.confirmedPercent)
    ])
  );
  addSection(
    rows,
    "Product performance",
    report.productPerformance.map((row) => [
      row.name,
      row.variantName ?? "",
      String(row.quantitySold),
      String(row.revenueVnd),
      String(row.revenueContributionPercent),
      String(row.costVnd),
      String(row.grossMarginVnd),
      String(row.grossMarginPercent),
      String(row.missingCostSnapshotCount)
    ])
  );
  addSection(
    rows,
    "Slow movers",
    report.slowMovers.map((row) => [row.name, row.variantName ?? "", String(row.quantitySold), String(row.revenueVnd), row.lastSoldAt ?? ""])
  );
  addSection(rows, "Tax report", Object.entries(report.taxReport).filter(([, value]) => typeof value !== "object").map(([key, value]) => [key, String(value)]));
  addSection(
    rows,
    "Payment reconciliation",
    report.taxReport.reconciliationByOrderStatus.map((row) => [row.paymentStatus, String(row.orderCount), String(row.orderTotalVnd)])
  );

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function buildWorkbook(report: SalesAnalyticsReportDto) {
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
        ...report.summary,
        ...report.taxReport
      }
    ]),
    "Summary"
  );
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.revenueBuckets), "Revenue");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.paymentMethodSplit), "Payments");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.favoriteItems), "Favorites");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.productPerformance), "Products");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.slowMovers), "Slow movers");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.taxReport.reconciliationByOrderStatus), "Reconciliation");
  return workbook;
}

function buildSimplePdf(report: SalesAnalyticsReportDto) {
  const lines = [
    "Lac Garden POS Sales Report",
    `Period: ${report.period.label}`,
    `Generated: ${new Date(report.generatedAt).toLocaleString("vi-VN")}`,
    "",
    `Sales revenue: ${formatVnd(report.summary.salesRevenueVnd)}`,
    `Orders: ${report.summary.orderCount}`,
    `Average order value: ${formatVnd(report.summary.averageOrderValueVnd)}`,
    `Gross margin: ${formatVnd(report.summary.grossMarginVnd)} (${report.summary.grossMarginPercent}%)`,
    `Taxable revenue: ${formatVnd(report.taxReport.taxableRevenueVnd)}`,
    `Tax amount: ${formatVnd(report.taxReport.taxAmountVnd)} (${report.taxReport.taxRatePercent}%)`,
    `Confirmed payments: ${formatVnd(report.taxReport.confirmedPaymentVnd)}`,
    `Pending payments: ${formatVnd(report.taxReport.pendingPaymentVnd)}`,
    "",
    "Top products:",
    ...report.bestSellers.slice(0, 10).map((row, index) => `${index + 1}. ${row.name}${row.variantName ? ` - ${row.variantName}` : ""}: ${row.quantitySold} sold, ${formatVnd(row.revenueVnd)}, margin ${row.grossMarginPercent}%`)
  ];
  return makePdf(lines);
}

function makePdf(lines: string[]) {
  const objects: string[] = [];
  const pageHeight = 842;
  const content = [
    "BT",
    "/F1 18 Tf",
    "50 790 Td",
    `(${escapePdfText(lines[0] ?? "")}) Tj`,
    "0 -30 Td",
    "/F1 10 Tf",
    ...lines.slice(1, 38).flatMap((line) => [`(${escapePdfText(line)}) Tj`, "0 -18 Td"]),
    "ET"
  ].join("\n");

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
    .join("\n");
  pdf += `\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function addSection(rows: string[][], title: string, sectionRows: string[][]) {
  rows.push([], [title]);
  rows.push(...sectionRows);
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapePdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}
