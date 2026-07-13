"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, Plus, RefreshCw, RotateCcw, WalletCards } from "lucide-react";
import { useState, type FormEvent } from "react";
import { formatVnd } from "@/lib/money";
import type { PayrollAdjustmentType, PayrollRunDto, PayrollSnapshotDto } from "@/types/payroll";
import styles from "./PayrollAdmin.module.scss";

type PendingOperation = "generate" | "review" | "adjustment" | null;

export function PayrollAdmin({ initialSnapshot }: { initialSnapshot: PayrollSnapshotDto }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [startDate, setStartDate] = useState(initialSnapshot.period.startDate);
  const [endDate, setEndDate] = useState(initialSnapshot.period.endDate);
  const [adjustmentLineId, setAdjustmentLineId] = useState(initialSnapshot.run?.lines[0]?.id ?? "");
  const [adjustmentType, setAdjustmentType] = useState<PayrollAdjustmentType>("BONUS");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [notice, setNotice] = useState("Bảng lương sẵn sàng.");
  const [pendingOperation, setPendingOperation] = useState<PendingOperation>(null);

  const run = snapshot.run;
  const isApproved = run?.status === "APPROVED";
  const isSubmitting = pendingOperation !== null;

  async function generateRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingOperation("generate");
    try {
      const response = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate })
      });
      const payload = (await response.json()) as { data?: PayrollRunDto; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không thể tạo bảng lương.");
      applyRun(payload.data, payload.data.lines.length);
      setNotice(`Đã tạo bảng lương ${payload.data.period.label}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể tạo bảng lương.");
    } finally {
      setPendingOperation(null);
    }
  }

  async function reviewRun(action: "mark_reviewed" | "approve" | "reopen") {
    if (!run) return;
    setPendingOperation("review");
    try {
      const response = await fetch("/api/payroll/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id, action })
      });
      const payload = (await response.json()) as { data?: PayrollRunDto; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không thể xét duyệt bảng lương.");
      applyRun(payload.data);
      setNotice(`Trạng thái bảng lương: ${payrollStatusText(payload.data.status)}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể xét duyệt bảng lương.");
    } finally {
      setPendingOperation(null);
    }
  }

  async function createAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustmentLineId) return;
    setPendingOperation("adjustment");
    try {
      const response = await fetch("/api/payroll/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineId: adjustmentLineId,
          adjustmentType,
          amountVnd: parseInteger(adjustmentAmount),
          reason: adjustmentReason
        })
      });
      const payload = (await response.json()) as { data?: PayrollRunDto; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không thể ghi điều chỉnh.");
      applyRun(payload.data);
      setAdjustmentAmount("");
      setAdjustmentReason("");
      setNotice("Đã ghi điều chỉnh lương.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể ghi điều chỉnh.");
    } finally {
      setPendingOperation(null);
    }
  }

  function applyRun(nextRun: PayrollRunDto, approvedTimesheetCount = snapshot.approvedTimesheetCount) {
    setSnapshot((current) => ({
      ...current,
      period: nextRun.period,
      run: nextRun,
      approvedTimesheetCount,
      missingApprovedTimesheetCount: Math.max(0, approvedTimesheetCount - nextRun.lines.length),
      summary: summarizeLines(nextRun.lines)
    }));
    setAdjustmentLineId(nextRun.lines[0]?.id ?? "");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/">
            <ArrowLeft size={16} /> POS
          </Link>
          <h1>Bảng lương</h1>
          <p>Bảng chấm công đã duyệt, tính lương, xét duyệt và xuất dữ liệu kế toán.</p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.secondaryButton} href={buildExportHref(snapshot, "csv")}>
            <Download size={16} /> CSV
          </a>
          <a className={styles.primaryButton} href={buildExportHref(snapshot, "xlsx")}>
            <FileSpreadsheet size={16} /> Excel
          </a>
        </div>
      </header>

      <form className={styles.filterBar} onSubmit={generateRun}>
        <label>
          <span>Từ ngày</span>
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label>
          <span>Đến ngày</span>
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
          {pendingOperation === "generate" ? <Loader2 className={styles.spinnerIcon} size={17} /> : <RefreshCw size={17} />}
          Tạo bảng lương
        </button>
      </form>

      <section className={styles.notice} role="status">
        {isSubmitting ? <Loader2 className={styles.spinnerIcon} size={18} /> : <WalletCards size={18} />}
        <span>{notice}</span>
      </section>

      <section className={styles.periodStrip}>
        <span>Kỳ</span>
        <strong>{snapshot.period.label}</strong>
        <small>
          Bảng chấm công đã duyệt: {snapshot.approvedTimesheetCount} · Chưa có trong đợt lương: {snapshot.missingApprovedTimesheetCount} · Trạng thái: {run ? payrollStatusText(run.status) : "Chưa tạo"}
        </small>
      </section>

      <section className={styles.metrics}>
        <Metric label="Nhân viên" value={String(snapshot.summary.employeeCount)} />
        <Metric label="Giờ đã duyệt" value={formatHours(snapshot.summary.approvedWorkedMinutes)} />
        <Metric label="Giờ tăng ca" value={formatHours(snapshot.summary.overtimeMinutes)} />
        <Metric label="Lương trước khấu trừ" value={formatVnd(snapshot.summary.grossPayVnd)} />
        <Metric label="Khấu trừ" value={formatVnd(snapshot.summary.deductionVnd)} tone={snapshot.summary.deductionVnd ? "warn" : undefined} />
        <Metric label="Thực nhận" value={formatVnd(snapshot.summary.netPayVnd)} tone="strong" />
      </section>

      <section className={styles.actionPanel}>
        <div>
          <strong>Quy trình xét duyệt</strong>
          <small>Tạo từ bảng chấm công đã duyệt, đánh dấu đã rà soát, sau đó duyệt để xuất kế toán.</small>
        </div>
        <div className={styles.actionRow}>
          <button type="button" onClick={() => reviewRun("mark_reviewed")} disabled={isSubmitting || !run || isApproved}>
            <CheckCircle2 size={16} /> Đánh dấu đã rà soát
          </button>
          <button type="button" onClick={() => reviewRun("approve")} disabled={isSubmitting || !run || isApproved}>
            <CheckCircle2 size={16} /> Duyệt
          </button>
          <button type="button" onClick={() => reviewRun("reopen")} disabled={isSubmitting || !run}>
            <RotateCcw size={16} /> Mở lại
          </button>
        </div>
      </section>

      <section className={styles.tablePanel}>
        <div className={styles.panelTitle}>
          <strong>Chi tiết lương</strong>
        </div>
        <table>
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Giờ làm</th>
              <th>Đơn giá</th>
              <th>Lương</th>
              <th>Điều chỉnh</th>
              <th>Thực nhận</th>
            </tr>
          </thead>
          <tbody>
            {run?.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <strong>{line.employeeName}</strong>
                  <small>{line.employeeCode ?? "Chưa có mã"} · {scheduleRoleText(line.scheduleRole)}</small>
                </td>
                <td>
                  <strong>{formatHours(line.approvedWorkedMinutes)}</strong>
                  <small>Giờ thường {formatHours(line.regularMinutes)} · Tăng ca {formatHours(line.overtimeMinutes)}</small>
                </td>
                <td>
                  <strong>{line.hourlyRateVnd ? `${formatVnd(line.hourlyRateVnd)}/giờ` : "Chưa có lương giờ"}</strong>
                  <small>Cố định {line.fixedSalaryVnd ? formatVnd(line.fixedSalaryVnd) : "-"} · Tăng ca x{line.overtimeMultiplier}</small>
                </td>
                <td>
                  <strong>{formatVnd(line.grossPayVnd)}</strong>
                  <small>Thường {formatVnd(line.regularPayVnd)} · Cố định {formatVnd(line.fixedPayVnd)} · Tăng ca {formatVnd(line.overtimePayVnd)}</small>
                </td>
                <td>
                  <strong>+{formatVnd(line.bonusVnd)} / -{formatVnd(line.deductionVnd)}</strong>
                  <small>{line.adjustments.length ? `${line.adjustments.length} điều chỉnh` : "Chưa có điều chỉnh"}</small>
                </td>
                <td>
                  <strong>{formatVnd(line.netPayVnd)}</strong>
                  <small>{line.calculationNotes[0] ?? "Chỉ tính từ bảng chấm công đã duyệt"}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!run?.lines.length ? <p className={styles.emptyState}>Chưa có đợt lương cho kỳ này.</p> : null}
      </section>

      <section className={styles.twoColumn}>
        <form className={styles.card} onSubmit={createAdjustment}>
          <div className={styles.panelTitle}>
            <Plus size={18} />
            <strong>Thưởng / khấu trừ</strong>
          </div>
          <label className={styles.field}>
            <span>Nhân viên</span>
            <select value={adjustmentLineId} onChange={(event) => setAdjustmentLineId(event.target.value)} disabled={!run || isApproved}>
              <option value="">Chọn nhân sự</option>
              {run?.lines.map((line) => <option key={line.id} value={line.id}>{line.employeeName}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span>Loại</span>
            <select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as PayrollAdjustmentType)} disabled={isApproved}>
              <option value="BONUS">Thưởng</option>
              <option value="DEDUCTION">Khấu trừ</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Số tiền (VND)</span>
            <input type="number" min="1" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} disabled={isApproved} />
          </label>
          <label className={styles.field}>
            <span>Lý do</span>
            <input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} disabled={isApproved} />
          </label>
          <button className={styles.primaryButton} type="submit" disabled={isSubmitting || !adjustmentLineId || isApproved}>
            {pendingOperation === "adjustment" ? <Loader2 className={styles.spinnerIcon} size={17} /> : <Plus size={17} />}
            Thêm điều chỉnh
          </button>
        </form>

        <section className={styles.card}>
          <div className={styles.panelTitle}>
            <strong>Ghi chú kiểm tra</strong>
          </div>
          <div className={styles.auditList}>
            {run?.lines.flatMap((line) => line.calculationNotes.map((note, index) => ({ id: `${line.id}-${index}`, employeeName: line.employeeName, note }))).map((item) => (
              <article key={item.id}>
                <strong>{item.employeeName}</strong>
                <span>{item.note}</span>
              </article>
            ))}
            {!run?.lines.length ? <p className={styles.emptyState}>Tạo bảng lương để xem ghi chú tính toán.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "warn" | "strong" }) {
  return (
    <article className={`${styles.metric} ${tone === "warn" ? styles.warnMetric : ""} ${tone === "strong" ? styles.strongMetric : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function summarizeLines(lines: PayrollRunDto["lines"]): PayrollSnapshotDto["summary"] {
  return {
    employeeCount: new Set(lines.map((line) => line.employeeProfileId)).size,
    approvedWorkedMinutes: sum(lines, (line) => line.approvedWorkedMinutes),
    overtimeMinutes: sum(lines, (line) => line.overtimeMinutes),
    regularPayVnd: sum(lines, (line) => line.regularPayVnd),
    fixedPayVnd: sum(lines, (line) => line.fixedPayVnd),
    overtimePayVnd: sum(lines, (line) => line.overtimePayVnd),
    bonusVnd: sum(lines, (line) => line.bonusVnd),
    deductionVnd: sum(lines, (line) => line.deductionVnd),
    grossPayVnd: sum(lines, (line) => line.grossPayVnd),
    netPayVnd: sum(lines, (line) => line.netPayVnd)
  };
}

function buildExportHref(snapshot: PayrollSnapshotDto, format: "csv" | "xlsx") {
  const params = new URLSearchParams({
    format,
    startDate: snapshot.period.startDate,
    endDate: snapshot.period.endDate
  });
  return `/api/payroll/export?${params.toString()}`;
}

function formatHours(minutes: number) {
  return `${Math.round((minutes / 60) * 100) / 100}h`;
}

function payrollStatusText(status: PayrollRunDto["status"]) {
  const labels: Record<PayrollRunDto["status"], string> = {
    DRAFT: "Bản nháp",
    REVIEWED: "Đã rà soát",
    APPROVED: "Đã duyệt"
  };
  return labels[status];
}

function scheduleRoleText(role: string) {
  const labels: Record<string, string> = {
    BAR: "Pha chế",
    CASHIER: "Thu ngân",
    SERVICE: "Phục vụ",
    MANAGER: "Quản lý"
  };
  return labels[role] ?? role;
}

function parseInteger(value: string) {
  return Number.parseInt(value || "0", 10);
}

function sum<T>(rows: T[], getValue: (row: T) => number) {
  return rows.reduce((total, row) => total + getValue(row), 0);
}
