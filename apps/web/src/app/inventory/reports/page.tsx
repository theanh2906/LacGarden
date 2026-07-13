import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3, Download, FileSpreadsheet, PieChart, TrendingUp } from "lucide-react";
import { requirePagePermission } from "@/server/auth";
import { getEmptyInventoryReport, getInventoryReport } from "@/server/inventory-reports";
import { inventoryReportQuerySchema, type InventoryReportQueryInput } from "@/server/inventory-validation";
import type {
  InventoryMovementTypeSummaryDto,
  InventoryReportBucketDto,
  InventoryReportDto,
  InventoryStockMovementDto,
  InventoryStockOverviewRowDto
} from "@/types/inventory";
import { InventoryAlertsPanel } from "./InventoryAlertsPanel";
import styles from "./InventoryReports.module.scss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Báo cáo kho | Lac Garden POS",
  description: "Báo cáo kho, biểu đồ, xuất dữ liệu và cảnh báo tồn thấp của Lac Garden POS"
};

type InventoryReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryReportsPage({ searchParams }: InventoryReportsPageProps) {
  await requirePagePermission("reports:view", "/inventory/reports");

  const query = parsePageQuery(await searchParams);
  let report: InventoryReportDto;

  try {
    report = await getInventoryReport(query);
  } catch (error) {
    console.info("[inventory] Failed to load inventory reports", error);
    report = getEmptyInventoryReport(query);
  }

  const exportCsvHref = buildExportHref(report, "csv");
  const exportXlsxHref = buildExportHref(report, "xlsx");
  const formValues = getFormValues(report);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/inventory">
            <ArrowLeft size={16} /> Quản lý kho
          </Link>
          <h1>Báo cáo kho</h1>
          <p>Báo cáo tồn kho, biến động, chi phí mua hàng và đối soát theo kỳ.</p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.secondaryButton} href={exportCsvHref}>
            <Download size={16} /> CSV
          </a>
          <a className={styles.primaryButton} href={exportXlsxHref}>
            <FileSpreadsheet size={16} /> Excel
          </a>
        </div>
      </header>

      <form className={styles.filterBar} action="/inventory/reports">
        <label>
          <span>Kỳ</span>
          <select name="mode" defaultValue={report.period.mode}>
            <option value="day">Ngày</option>
            <option value="month">Tháng</option>
            <option value="year">Năm</option>
            <option value="custom">Tuỳ chọn</option>
          </select>
        </label>
        <label>
          <span>Ngày</span>
          <input name="date" type="date" defaultValue={formValues.date} />
        </label>
        <label>
          <span>Tháng</span>
          <input name="month" type="month" defaultValue={formValues.month} />
        </label>
        <label>
          <span>Năm</span>
          <input name="year" type="number" min="2000" max="2100" defaultValue={formValues.year} />
        </label>
        <label>
          <span>Từ ngày</span>
          <input name="startDate" type="date" defaultValue={formValues.startDate} />
        </label>
        <label>
          <span>Đến ngày</span>
          <input name="endDate" type="date" defaultValue={formValues.endDate} />
        </label>
        <button className={styles.primaryButton} type="submit">
          Áp dụng
        </button>
      </form>

      <section className={styles.periodStrip}>
        <span>Kỳ</span>
        <strong>{report.period.label}</strong>
        <small>
          {formatDate(report.period.startDate)} - {formatDate(addDaysIso(report.period.endDate, -1))}
        </small>
      </section>

      <section className={styles.metrics} aria-label="Tổng quan báo cáo kho">
        <Metric label="Nguyên liệu" value={formatNumber(report.summary.totalItems)} />
        <Metric label="Sắp hết" value={formatNumber(report.summary.lowStockItems)} tone="warn" />
        <Metric label="Hết hàng" value={formatNumber(report.summary.outOfStockItems)} tone="danger" />
        <Metric label="Chi phí mua" value={formatVnd(report.summary.totalPurchaseCostVnd)} />
        <Metric label="Biến động" value={formatNumber(totalMovements(report))} />
        <Metric label="Hoá đơn đã đính kèm" value={`${formatNumber(report.summary.attachedInvoiceCount)}/${formatNumber(report.summary.invoiceUploadCount)}`} />
      </section>

      <section className={styles.dashboardGrid}>
        <InventoryAlertsPanel
          lowStockItems={report.lowStockItems}
          outOfStockItems={report.outOfStockItems}
          staleStockItems={report.staleStockItems}
        />
        <section className={styles.panel}>
          <div className={styles.panelTitle}>
            <BarChart3 size={18} />
            <strong>Chi phí mua hàng</strong>
          </div>
          <BarChart buckets={report.purchaseCostBuckets} valueKey="totalCostVnd" formatter={formatCompactVnd} />
        </section>
        <section className={styles.panel}>
          <div className={styles.panelTitle}>
            <TrendingUp size={18} />
            <strong>Xu hướng biến động tồn kho</strong>
          </div>
          <LineChart buckets={report.stockTrendBuckets} />
        </section>
        <section className={styles.panel}>
          <div className={styles.panelTitle}>
            <PieChart size={18} />
            <strong>Phân loại biến động</strong>
          </div>
          <DonutBreakdown rows={report.movementTypeBreakdown} />
        </section>
      </section>

      <section className={styles.twoColumn}>
        <ReportTable title="Tổng quan tồn kho hiện tại" columns={["Nguyên liệu", "Tồn", "Ngưỡng", "Biến động gần nhất", "Trạng thái"]}>
          {report.stockOverview.slice(0, 12).map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.name}</strong>
                <small>{item.code ?? "Chưa có mã"}</small>
              </td>
              <td>{formatQuantity(item.currentQuantity, item.unit)}</td>
              <td>{formatQuantity(item.lowStockThreshold, item.unit)}</td>
              <td>{item.lastMovementAt ? formatDateTime(item.lastMovementAt) : "-"}</td>
              <td>
                <StatusPill state={item.alertState} />
              </td>
            </tr>
          ))}
        </ReportTable>

        <ReportTable title="Nguyên liệu sắp hết" columns={["Nguyên liệu", "Tồn", "Ngưỡng", "Trạng thái"]}>
          {report.lowStockItems.concat(report.outOfStockItems).map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.name}</strong>
                <small>{item.code ?? "Chưa có mã"}</small>
              </td>
              <td>{formatQuantity(item.currentQuantity, item.unit)}</td>
              <td>{formatQuantity(item.lowStockThreshold, item.unit)}</td>
              <td>
                <StatusPill state={item.alertState} />
              </td>
            </tr>
          ))}
        </ReportTable>
      </section>

      <section className={styles.twoColumn}>
        <ReportTable title="Nguyên liệu biến động nhiều" columns={["Nguyên liệu", "Chênh lệch", "Đã thay đổi", "Chi phí"]}>
          {report.topChangedIngredients.map((item) => (
            <tr key={item.inventoryItemId}>
              <td>
                <strong>{item.itemName}</strong>
                <small>{item.movementCount} biến động</small>
              </td>
              <td>{formatQuantity(item.netQuantityDelta, item.unit)}</td>
              <td>{formatQuantity(item.totalQuantityChanged, item.unit)}</td>
              <td>{formatVnd(item.totalCostVnd)}</td>
            </tr>
          ))}
        </ReportTable>
      </section>

      <section className={styles.twoColumn}>
        <ReportTable title="Biến động kho gần đây" columns={["Thời gian", "Nguyên liệu", "Loại", "Chênh lệch", "Chi phí"]}>
          {report.recentMovements.map((movement) => (
            <tr key={movement.id}>
              <td>{formatDateTime(movement.createdAt)}</td>
              <td>{movement.itemName}</td>
              <td>{movementLabel(movement.movementType)}</td>
              <td>{formatNumber(movement.quantityDelta)}</td>
              <td>{movement.totalCostVnd ? formatVnd(movement.totalCostVnd) : "-"}</td>
            </tr>
          ))}
        </ReportTable>

        <ReportTable title="Đối soát hoá đơn/nhập dữ liệu" columns={["Thời gian", "Tệp", "Loại", "Trạng thái"]}>
          {report.reconciliation.latestUploads.map((upload) => (
            <tr key={upload.id}>
              <td>{formatDateTime(upload.createdAt)}</td>
              <td>
                <strong>{upload.originalFileName}</strong>
                <small>{formatFileSize(upload.fileSize)}</small>
              </td>
              <td>{uploadTypeLabel(upload.uploadType)}</td>
              <td>{uploadStatusLabel(upload.status)}</td>
            </tr>
          ))}
          {report.reconciliation.latestImportBatches.map((batch) => (
            <tr key={batch.id}>
              <td>{formatDateTime(batch.createdAt)}</td>
              <td>
                <strong>{batch.upload.originalFileName}</strong>
                <small>
                  {batch.validRowCount} hợp lệ · {batch.invalidRowCount} không hợp lệ
                </small>
              </td>
              <td>{parserUsedLabel(batch.parserUsed)}</td>
              <td>{importBatchStatusLabel(batch.status)}</td>
            </tr>
          ))}
        </ReportTable>
      </section>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  return (
    <article className={`${styles.metric} ${tone === "warn" ? styles.warnMetric : ""} ${tone === "danger" ? styles.dangerMetric : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ReportTable({ title, columns, children }: { title: string; columns: string[]; children: ReactNode }) {
  return (
    <section className={styles.tablePanel}>
      <div className={styles.panelTitle}>
        <strong>{title}</strong>
      </div>
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {!children || (Array.isArray(children) && children.length === 0) ? <p className={styles.emptyText}>Không có dữ liệu trong kỳ này.</p> : null}
    </section>
  );
}

function BarChart({
  buckets,
  valueKey,
  formatter
}: {
  buckets: InventoryReportBucketDto[];
  valueKey: "totalCostVnd" | "movementCount" | "netQuantityDelta";
  formatter: (value: number) => string;
}) {
  const max = Math.max(1, ...buckets.map((bucket) => Math.abs(bucket[valueKey])));
  return (
    <div className={styles.barChart}>
      {buckets.map((bucket) => {
        const height = Math.max(4, (Math.abs(bucket[valueKey]) / max) * 100);
        return (
          <div className={styles.barColumn} key={bucket.key}>
            <span className={styles.barValue}>{bucket[valueKey] ? formatter(bucket[valueKey]) : ""}</span>
            <div className={styles.barTrack}>
              <span style={{ height: `${height}%` }} />
            </div>
            <small>{bucket.label}</small>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ buckets }: { buckets: InventoryReportBucketDto[] }) {
  const values = buckets.map((bucket) => bucket.netQuantityDelta);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const points = buckets.map((bucket, index) => {
    const x = buckets.length <= 1 ? 50 : (index / (buckets.length - 1)) * 100;
    const y = 90 - ((bucket.netQuantityDelta - min) / range) * 78;
    return `${x},${y}`;
  });

  return (
    <div className={styles.lineChart}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Xu hướng biến động tồn kho">
        <path d="M0 90 H100" />
        <polyline points={points.join(" ")} />
      </svg>
      <div className={styles.chartLegend}>
        <span>{buckets[0]?.label ?? "-"}</span>
        <strong>Ròng {formatNumber(values.reduce((total, value) => total + value, 0))}</strong>
        <span>{buckets[buckets.length - 1]?.label ?? "-"}</span>
      </div>
    </div>
  );
}

function DonutBreakdown({ rows }: { rows: InventoryMovementTypeSummaryDto[] }) {
  const total = rows.reduce((sum, row) => sum + row.movementCount, 0);
  let cursor = 0;
  const colors = ["#7b3f22", "#b78d72", "#c75840", "#476a58"];
  const gradient = rows
    .map((row, index) => {
      const start = total ? (cursor / total) * 100 : 0;
      cursor += row.movementCount;
      const end = total ? (cursor / total) * 100 : 0;
      return `${colors[index % colors.length]} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className={styles.donutWrap}>
      <div className={styles.donut} style={{ "--donut": total ? gradient : "#ead9bf 0% 100%" } as CSSProperties}>
        <strong>{formatNumber(total)}</strong>
        <span>biến động</span>
      </div>
      <div className={styles.breakdownList}>
        {rows.map((row, index) => (
          <div key={row.movementType}>
            <span style={{ background: colors[index % colors.length] }} />
            <strong>{row.label}</strong>
            <small>
              {formatNumber(row.movementCount)} · {formatNumber(row.totalQuantityAbs)}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ state }: { state: InventoryStockOverviewRowDto["alertState"] }) {
  return <span className={`${styles.statusPill} ${styles[`status_${state}`]}`}>{state}</span>;
}

function parsePageQuery(params: Record<string, string | string[] | undefined>): InventoryReportQueryInput {
  const normalized = Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      const raw = Array.isArray(value) ? value[0] : value;
      return raw ? [[key, raw]] : [];
    })
  );
  return inventoryReportQuerySchema.catch({ mode: "month" }).parse(normalized);
}

function getFormValues(report: InventoryReportDto) {
  const start = report.period.startDate.slice(0, 10);
  const end = addDaysIso(report.period.endDate, -1).slice(0, 10);
  return {
    date: start,
    month: start.slice(0, 7),
    year: start.slice(0, 4),
    startDate: start,
    endDate: end
  };
}

function buildExportHref(report: InventoryReportDto, format: "csv" | "xlsx") {
  const values = getFormValues(report);
  const params = new URLSearchParams({ mode: report.period.mode, format });
  if (report.period.mode === "day") params.set("date", values.date);
  if (report.period.mode === "month") params.set("month", values.month);
  if (report.period.mode === "year") params.set("year", values.year);
  if (report.period.mode === "custom") {
    params.set("startDate", values.startDate);
    params.set("endDate", values.endDate);
  }
  return `/api/inventory/reports/export?${params.toString()}`;
}

function totalMovements(report: InventoryReportDto) {
  return (
    report.summary.purchaseMovementCount +
    report.summary.wasteMovementCount +
    report.summary.adjustmentMovementCount +
    report.summary.correctionMovementCount
  );
}

function movementLabel(type: InventoryStockMovementDto["movementType"]) {
  const labels: Record<InventoryStockMovementDto["movementType"], string> = {
    PURCHASE: "Nhập mua",
    ADJUSTMENT: "Điều chỉnh",
    WASTE: "Hao hụt",
    CORRECTION: "Kiểm kho"
  };
  return labels[type];
}

function uploadTypeLabel(type: string) {
  const labels: Record<string, string> = { INVOICE: "Hoá đơn", IMPORT: "Nhập dữ liệu" };
  return labels[type] ?? type;
}

function uploadStatusLabel(status: string) {
  const labels: Record<string, string> = {
    STORED: "Đã lưu",
    PARSED: "Đã phân tích",
    ATTACHED: "Đã đính kèm",
    FAILED: "Thất bại"
  };
  return labels[status] ?? status;
}

function parserUsedLabel(parser: string) {
  const labels: Record<string, string> = {
    DETERMINISTIC: "Quy tắc cố định",
    GEMINI: "Gemini",
    MIXED: "Kết hợp"
  };
  return labels[parser] ?? parser;
}

function importBatchStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Bản nháp",
    PARSED: "Đã phân tích",
    CONFIRMED: "Đã xác nhận",
    FAILED: "Thất bại"
  };
  return labels[status] ?? status;
}

function addDaysIso(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function formatQuantity(quantity: number, unit: string) {
  return `${formatNumber(quantity)} ${unit}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value);
}

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

function formatCompactVnd(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 100) / 10}K`;
  return formatNumber(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / 1024 / 102.4) / 10} MB`;
}
