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
  const [notice, setNotice] = useState("Payroll ready.");
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
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không generate được payroll.");
      applyRun(payload.data, payload.data.lines.length);
      setNotice(`Đã generate payroll ${payload.data.period.label}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không generate được payroll.");
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
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không review được payroll.");
      applyRun(payload.data);
      setNotice(`Payroll status: ${payload.data.status}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không review được payroll.");
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
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không ghi được adjustment.");
      applyRun(payload.data);
      setAdjustmentAmount("");
      setAdjustmentReason("");
      setNotice("Đã ghi payroll adjustment.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không ghi được adjustment.");
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
          <h1>Payroll</h1>
          <p>Approved timesheets, salary calculation, review, and accounting export.</p>
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
          Generate payroll
        </button>
      </form>

      <section className={styles.notice} role="status">
        {isSubmitting ? <Loader2 className={styles.spinnerIcon} size={18} /> : <WalletCards size={18} />}
        <span>{notice}</span>
      </section>

      <section className={styles.periodStrip}>
        <span>Period</span>
        <strong>{snapshot.period.label}</strong>
        <small>
          Approved timesheets: {snapshot.approvedTimesheetCount} · Missing from run: {snapshot.missingApprovedTimesheetCount} · Status: {run?.status ?? "NOT_GENERATED"}
        </small>
      </section>

      <section className={styles.metrics}>
        <Metric label="Employees" value={String(snapshot.summary.employeeCount)} />
        <Metric label="Approved hours" value={formatHours(snapshot.summary.approvedWorkedMinutes)} />
        <Metric label="OT hours" value={formatHours(snapshot.summary.overtimeMinutes)} />
        <Metric label="Gross" value={formatVnd(snapshot.summary.grossPayVnd)} />
        <Metric label="Deductions" value={formatVnd(snapshot.summary.deductionVnd)} tone={snapshot.summary.deductionVnd ? "warn" : undefined} />
        <Metric label="Net pay" value={formatVnd(snapshot.summary.netPayVnd)} tone="strong" />
      </section>

      <section className={styles.actionPanel}>
        <div>
          <strong>Review workflow</strong>
          <small>Generate from approved timesheets, mark reviewed, then approve for accounting export.</small>
        </div>
        <div className={styles.actionRow}>
          <button type="button" onClick={() => reviewRun("mark_reviewed")} disabled={isSubmitting || !run || isApproved}>
            <CheckCircle2 size={16} /> Mark reviewed
          </button>
          <button type="button" onClick={() => reviewRun("approve")} disabled={isSubmitting || !run || isApproved}>
            <CheckCircle2 size={16} /> Approve
          </button>
          <button type="button" onClick={() => reviewRun("reopen")} disabled={isSubmitting || !run}>
            <RotateCcw size={16} /> Reopen
          </button>
        </div>
      </section>

      <section className={styles.tablePanel}>
        <div className={styles.panelTitle}>
          <strong>Payroll lines</strong>
        </div>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Hours</th>
              <th>Rates</th>
              <th>Pay</th>
              <th>Adjustments</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {run?.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <strong>{line.employeeName}</strong>
                  <small>{line.employeeCode ?? "No code"} · {line.scheduleRole}</small>
                </td>
                <td>
                  <strong>{formatHours(line.approvedWorkedMinutes)}</strong>
                  <small>Regular {formatHours(line.regularMinutes)} · OT {formatHours(line.overtimeMinutes)}</small>
                </td>
                <td>
                  <strong>{line.hourlyRateVnd ? `${formatVnd(line.hourlyRateVnd)}/h` : "No hourly"}</strong>
                  <small>Fixed {line.fixedSalaryVnd ? formatVnd(line.fixedSalaryVnd) : "-"} · OT x{line.overtimeMultiplier}</small>
                </td>
                <td>
                  <strong>{formatVnd(line.grossPayVnd)}</strong>
                  <small>Regular {formatVnd(line.regularPayVnd)} · Fixed {formatVnd(line.fixedPayVnd)} · OT {formatVnd(line.overtimePayVnd)}</small>
                </td>
                <td>
                  <strong>+{formatVnd(line.bonusVnd)} / -{formatVnd(line.deductionVnd)}</strong>
                  <small>{line.adjustments.length ? `${line.adjustments.length} adjustment(s)` : "No adjustments"}</small>
                </td>
                <td>
                  <strong>{formatVnd(line.netPayVnd)}</strong>
                  <small>{line.calculationNotes[0] ?? "Approved timesheet only"}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!run?.lines.length ? <p className={styles.emptyState}>Chưa có payroll run cho kỳ này.</p> : null}
      </section>

      <section className={styles.twoColumn}>
        <form className={styles.card} onSubmit={createAdjustment}>
          <div className={styles.panelTitle}>
            <Plus size={18} />
            <strong>Bonus / deduction</strong>
          </div>
          <label className={styles.field}>
            <span>Line</span>
            <select value={adjustmentLineId} onChange={(event) => setAdjustmentLineId(event.target.value)} disabled={!run || isApproved}>
              <option value="">Chọn nhân sự</option>
              {run?.lines.map((line) => <option key={line.id} value={line.id}>{line.employeeName}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span>Type</span>
            <select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as PayrollAdjustmentType)} disabled={isApproved}>
              <option value="BONUS">BONUS</option>
              <option value="DEDUCTION">DEDUCTION</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Amount VND</span>
            <input type="number" min="1" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} disabled={isApproved} />
          </label>
          <label className={styles.field}>
            <span>Reason</span>
            <input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} disabled={isApproved} />
          </label>
          <button className={styles.primaryButton} type="submit" disabled={isSubmitting || !adjustmentLineId || isApproved}>
            {pendingOperation === "adjustment" ? <Loader2 className={styles.spinnerIcon} size={17} /> : <Plus size={17} />}
            Add adjustment
          </button>
        </form>

        <section className={styles.card}>
          <div className={styles.panelTitle}>
            <strong>Audit notes</strong>
          </div>
          <div className={styles.auditList}>
            {run?.lines.flatMap((line) => line.calculationNotes.map((note, index) => ({ id: `${line.id}-${index}`, employeeName: line.employeeName, note }))).map((item) => (
              <article key={item.id}>
                <strong>{item.employeeName}</strong>
                <span>{item.note}</span>
              </article>
            ))}
            {!run?.lines.length ? <p className={styles.emptyState}>Generate payroll để xem calculation notes.</p> : null}
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

function parseInteger(value: string) {
  return Number.parseInt(value || "0", 10);
}

function sum<T>(rows: T[], getValue: (row: T) => number) {
  return rows.reduce((total, row) => total + getValue(row), 0);
}
