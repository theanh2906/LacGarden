import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3, Download, FileSpreadsheet, FileText, PieChart, ReceiptText, TrendingUp } from "lucide-react";
import { requirePagePermission } from "@/server/auth";
import { getEmptySalesAnalyticsReport, getSalesAnalyticsReport } from "@/server/sales-reports";
import { salesReportQuerySchema, type SalesReportQueryInput } from "@/server/sales-reports-validation";
import type {
  PaymentMethodSplitDto,
  ProductPerformanceRowDto,
  SalesAnalyticsReportDto,
  SalesReportBucketDto,
  SalesReportMode
} from "@/types/sales-reports";
import styles from "./SalesReports.module.scss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales Analytics | Lac Garden POS",
  description: "Sales, product performance, payment reconciliation, tax, and exports for Lac Garden POS"
};

type SalesReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesReportsPage({ searchParams }: SalesReportsPageProps) {
  await requirePagePermission("reports:view", "/reports");

  const query = parsePageQuery(await searchParams);
  let report: SalesAnalyticsReportDto;

  try {
    report = await getSalesAnalyticsReport(query);
  } catch (error) {
    console.info("[sales-reports] Failed to load sales analytics", error);
    report = getEmptySalesAnalyticsReport(query);
  }

  const formValues = getFormValues(report);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/">
            <ArrowLeft size={16} /> POS
          </Link>
          <h1>Sales analytics</h1>
          <p>Revenue, product performance, payment reconciliation, tax, and manager exports.</p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.secondaryButton} href={buildExportHref(report, "csv")}>
            <Download size={16} /> CSV
          </a>
          <a className={styles.secondaryButton} href={buildExportHref(report, "xlsx")}>
            <FileSpreadsheet size={16} /> Excel
          </a>
          <a className={styles.primaryButton} href={buildExportHref(report, "pdf")}>
            <FileText size={16} /> PDF
          </a>
        </div>
      </header>

      <form className={styles.filterBar} action="/reports">
        <label>
          <span>Kỳ</span>
          <select name="mode" defaultValue={report.period.mode}>
            <option value="day">Ngày</option>
            <option value="week">Tuần</option>
            <option value="month">Tháng</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          <span>Ngày</span>
          <input name="date" type="date" defaultValue={formValues.date} />
        </label>
        <label>
          <span>Tuần</span>
          <input name="week" type="week" defaultValue={formValues.week} />
        </label>
        <label>
          <span>Tháng</span>
          <input name="month" type="month" defaultValue={formValues.month} />
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
          Apply
        </button>
      </form>

      <section className={styles.periodStrip}>
        <span>Period</span>
        <strong>{report.period.label}</strong>
        <small>
          {formatDate(report.period.startDate)} - {formatDate(addDaysIso(report.period.endDate, -1))}
        </small>
      </section>

      <section className={styles.metrics} aria-label="Sales report summary">
        <Metric label="Revenue" value={formatVnd(report.summary.salesRevenueVnd)} />
        <Metric label="Orders" value={formatNumber(report.summary.orderCount)} />
        <Metric label="AOV" value={formatVnd(report.summary.averageOrderValueVnd)} />
        <Metric label="Gross margin" value={`${report.summary.grossMarginPercent}%`} tone={report.summary.grossMarginPercent < 35 ? "warn" : undefined} />
        <Metric label="Tax" value={formatVnd(report.taxReport.taxAmountVnd)} />
        <Metric label="Pending pay" value={formatVnd(report.taxReport.pendingPaymentVnd)} tone={report.taxReport.pendingPaymentVnd ? "danger" : undefined} />
      </section>

      <section className={styles.dashboardGrid}>
        <section className={styles.panelLarge}>
          <div className={styles.panelTitle}>
            <BarChart3 size={18} />
            <strong>Sales revenue</strong>
          </div>
          <RevenueBarChart buckets={report.revenueBuckets} />
        </section>
        <section className={styles.panel}>
          <div className={styles.panelTitle}>
            <TrendingUp size={18} />
            <strong>Order count & AOV</strong>
          </div>
          <OrderLineChart buckets={report.revenueBuckets} />
        </section>
        <section className={styles.panel}>
          <div className={styles.panelTitle}>
            <PieChart size={18} />
            <strong>Payment split</strong>
          </div>
          <PaymentDonut rows={report.paymentMethodSplit} />
        </section>
      </section>

      <section className={styles.twoColumn}>
        <ReportTable title="Favorite items by quantity" columns={["Product", "Qty", "Revenue", "Contribution"]}>
          {report.favoriteItems.map((item) => (
            <ProductRow key={item.key} item={item} mode="favorite" />
          ))}
        </ReportTable>
        <ReportTable title="Product performance" columns={["Product", "Qty", "Revenue", "Gross margin", "Cost"]}>
          {report.bestSellers.map((item) => (
            <ProductRow key={item.key} item={item} mode="performance" />
          ))}
        </ReportTable>
      </section>

      <section className={styles.twoColumn}>
        <ReportTable title="Slow movers" columns={["Product", "Qty", "Revenue", "Last sold"]}>
          {report.slowMovers.map((item) => (
            <tr key={item.key}>
              <td>
                <strong>{item.name}</strong>
                <small>{item.variantName ?? "Default"}</small>
              </td>
              <td>{formatNumber(item.quantitySold)}</td>
              <td>{formatVnd(item.revenueVnd)}</td>
              <td>{item.lastSoldAt ? formatDateTime(item.lastSoldAt) : "-"}</td>
            </tr>
          ))}
        </ReportTable>

        <section className={styles.taxPanel}>
          <div className={styles.panelTitle}>
            <ReceiptText size={18} />
            <strong>Tax & reconciliation</strong>
          </div>
          <div className={styles.taxGrid}>
            <TaxCell label="Taxable revenue" value={formatVnd(report.taxReport.taxableRevenueVnd)} />
            <TaxCell label={`Tax (${report.taxReport.taxRatePercent}%)`} value={formatVnd(report.taxReport.taxAmountVnd)} />
            <TaxCell label="Discounts" value={formatVnd(report.taxReport.discountsVnd)} />
            <TaxCell label="Service charge" value={formatVnd(report.taxReport.serviceChargeVnd)} />
            <TaxCell label="Confirmed payments" value={formatVnd(report.taxReport.confirmedPaymentVnd)} />
            <TaxCell label="Payment difference" value={formatVnd(report.taxReport.paymentDifferenceVnd)} tone={report.taxReport.paymentDifferenceVnd ? "warn" : undefined} />
          </div>
          <table className={styles.reconciliationTable}>
            <thead>
              <tr>
                <th>Payment status</th>
                <th>Orders</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {report.taxReport.reconciliationByOrderStatus.map((row) => (
                <tr key={row.paymentStatus}>
                  <td>{row.paymentStatus}</td>
                  <td>{formatNumber(row.orderCount)}</td>
                  <td>{formatVnd(row.orderTotalVnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
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
  const isEmpty = Array.isArray(children) && children.length === 0;
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
      {isEmpty ? <p className={styles.emptyText}>Không có dữ liệu trong kỳ này.</p> : null}
    </section>
  );
}

function ProductRow({ item, mode }: { item: ProductPerformanceRowDto; mode: "favorite" | "performance" }) {
  return (
    <tr>
      <td>
        <strong>{item.name}</strong>
        <small>
          {item.variantName ?? "Default"}
          {item.missingCostSnapshotCount ? ` · ${item.missingCostSnapshotCount} no-cost lines` : ""}
        </small>
      </td>
      <td>{formatNumber(item.quantitySold)}</td>
      <td>{formatVnd(item.revenueVnd)}</td>
      {mode === "favorite" ? (
        <td>{item.revenueContributionPercent}%</td>
      ) : (
        <>
          <td className={item.grossMarginPercent < 35 ? styles.warnCell : undefined}>{item.grossMarginPercent}%</td>
          <td>{formatVnd(item.costVnd)}</td>
        </>
      )}
    </tr>
  );
}

function RevenueBarChart({ buckets }: { buckets: SalesReportBucketDto[] }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.revenueVnd));
  return (
    <div className={styles.barChart}>
      {buckets.map((bucket) => {
        const height = Math.max(4, (bucket.revenueVnd / max) * 100);
        return (
          <div className={styles.barColumn} key={bucket.key}>
            <span className={styles.barValue}>{bucket.revenueVnd ? formatCompactVnd(bucket.revenueVnd) : ""}</span>
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

function OrderLineChart({ buckets }: { buckets: SalesReportBucketDto[] }) {
  const maxOrders = Math.max(1, ...buckets.map((bucket) => bucket.orderCount));
  const maxAov = Math.max(1, ...buckets.map((bucket) => bucket.averageOrderValueVnd));
  const orderPoints = buckets.map((bucket, index) => {
    const x = buckets.length <= 1 ? 50 : (index / (buckets.length - 1)) * 100;
    const y = 90 - (bucket.orderCount / maxOrders) * 78;
    return `${x},${y}`;
  });
  const aovPoints = buckets.map((bucket, index) => {
    const x = buckets.length <= 1 ? 50 : (index / (buckets.length - 1)) * 100;
    const y = 90 - (bucket.averageOrderValueVnd / maxAov) * 78;
    return `${x},${y}`;
  });

  return (
    <div className={styles.lineChart}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Order count and average order value trend">
        <path d="M0 90 H100" />
        <polyline points={orderPoints.join(" ")} />
        <polyline className={styles.aovLine} points={aovPoints.join(" ")} />
      </svg>
      <div className={styles.chartLegend}>
        <span>{buckets[0]?.label ?? "-"}</span>
        <strong>
          {formatNumber(buckets.reduce((total, bucket) => total + bucket.orderCount, 0))} orders · AOV{" "}
          {formatVnd(Math.round(buckets.reduce((total, bucket) => total + bucket.averageOrderValueVnd, 0) / Math.max(1, buckets.length)))}
        </strong>
        <span>{buckets[buckets.length - 1]?.label ?? "-"}</span>
      </div>
    </div>
  );
}

function PaymentDonut({ rows }: { rows: PaymentMethodSplitDto[] }) {
  const total = rows.reduce((sum, row) => sum + row.confirmedAmountVnd, 0);
  let cursor = 0;
  const colors = ["#7b3f22", "#476a58", "#b8752d", "#c75840", "#8c7a67"];
  const gradient = rows
    .map((row, index) => {
      const start = total ? (cursor / total) * 100 : 0;
      cursor += row.confirmedAmountVnd;
      const end = total ? (cursor / total) * 100 : 0;
      return `${colors[index % colors.length]} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className={styles.donutWrap}>
      <div className={styles.donut} style={{ "--donut": total ? gradient : "#ead9bf 0% 100%" } as CSSProperties}>
        <strong>{formatCompactVnd(total)}</strong>
        <span>paid</span>
      </div>
      <div className={styles.breakdownList}>
        {rows.map((row, index) => (
          <div key={row.method}>
            <span style={{ background: colors[index % colors.length] }} />
            <strong>{paymentMethodLabel(row.method)}</strong>
            <small>
              {formatVnd(row.confirmedAmountVnd)} · {row.confirmedPercent}%
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaxCell({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className={`${styles.taxCell} ${tone === "warn" ? styles.warnTaxCell : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function parsePageQuery(params: Record<string, string | string[] | undefined>): SalesReportQueryInput {
  const normalized = Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      const raw = Array.isArray(value) ? value[0] : value;
      return raw ? [[key, raw]] : [];
    })
  );
  return salesReportQuerySchema.catch({ mode: "month" }).parse(normalized);
}

function getFormValues(report: SalesAnalyticsReportDto) {
  const start = report.period.startDate.slice(0, 10);
  const end = addDaysIso(report.period.endDate, -1).slice(0, 10);
  return {
    date: start,
    week: getWeekInputValue(report),
    month: start.slice(0, 7),
    startDate: start,
    endDate: end
  };
}

function getWeekInputValue(report: SalesAnalyticsReportDto) {
  if (report.period.mode === "week" && /^Week \d{4}-W\d{2}$/.test(report.period.label)) {
    return report.period.label.replace("Week ", "");
  }
  return "";
}

function buildExportHref(report: SalesAnalyticsReportDto, format: "csv" | "xlsx" | "pdf") {
  const values = getFormValues(report);
  const params = new URLSearchParams({ mode: report.period.mode, format });
  if (report.period.mode === "day") params.set("date", values.date);
  if (report.period.mode === "week" && values.week) params.set("week", values.week);
  if (report.period.mode === "month") params.set("month", values.month);
  if (report.period.mode === "custom") {
    params.set("startDate", values.startDate);
    params.set("endDate", values.endDate);
  }
  return `/api/reports/export?${params.toString()}`;
}

function paymentMethodLabel(method: PaymentMethodSplitDto["method"]) {
  const labels: Record<PaymentMethodSplitDto["method"], string> = {
    CASH: "Tiền mặt",
    BANK_TRANSFER: "Chuyển khoản",
    QR: "QR",
    CARD: "Thẻ",
    OTHER: "Khác"
  };
  return labels[method];
}

function addDaysIso(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
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
