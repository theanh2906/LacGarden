import { Prisma } from "@prisma/client";
import { getDb } from "@/server/db";
import type {
  CreatePayrollAdjustmentInput,
  GeneratePayrollRunInput,
  PayrollQueryInput,
  ReviewPayrollRunInput
} from "@/server/payroll-validation";
import type { PayrollAdjustmentDto, PayrollLineDto, PayrollPeriodDto, PayrollRunDto, PayrollSnapshotDto } from "@/types/payroll";

const TIME_ZONE = "Asia/Bangkok";
const DEFAULT_OVERTIME_MULTIPLIER = 1.5;

type StaffContext = {
  staffId?: string;
};

type PayrollRunRecord = Prisma.PayrollRunGetPayload<{
  include: {
    period: true;
    lines: {
      include: {
        employeeProfile: true;
        timesheet: true;
        adjustments: { orderBy: { createdAt: "desc" } };
      };
      orderBy: { employeeProfile: { displayName: "asc" } };
    };
  };
}>;

type PayrollLineRecord = PayrollRunRecord["lines"][number];

export class PayrollServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollServiceError";
  }
}

export function getPayrollErrorMessage(error: unknown) {
  if (error instanceof PayrollServiceError) return error.message;
  return "Payroll operation failed. Check admin logs for details.";
}

export async function getPayrollSnapshot(input: Partial<PayrollQueryInput> = {}): Promise<PayrollSnapshotDto> {
  const periodInput = resolvePayrollPeriod(input);
  const db = getDb();
  const [period, approvedTimesheetCount] = await Promise.all([
    db.payrollPeriod.findUnique({
      where: {
        periodStart_periodEnd: {
          periodStart: dateOnly(periodInput.startDate),
          periodEnd: dateOnly(periodInput.endDate)
        }
      }
    }),
    db.timesheet.count({
      where: approvedTimesheetWhere(periodInput.startDate, periodInput.endDate)
    })
  ]);

  const run = period
    ? await db.payrollRun.findUnique({
        where: { periodId: period.id },
        include: payrollRunInclude
      })
    : null;

  const periodDto = period
    ? mapPayrollPeriod(period)
    : {
        id: "",
        startDate: periodInput.startDate,
        endDate: periodInput.endDate,
        label: `${formatDateLabel(periodInput.startDate)} - ${formatDateLabel(periodInput.endDate)}`
      };
  const runDto = run ? mapPayrollRun(run) : null;

  return {
    period: periodDto,
    run: runDto,
    approvedTimesheetCount,
    missingApprovedTimesheetCount: Math.max(0, approvedTimesheetCount - (runDto?.lines.length ?? 0)),
    summary: summarizeLines(runDto?.lines ?? [])
  };
}

export async function generatePayrollRun(input: GeneratePayrollRunInput, context: StaffContext = {}): Promise<PayrollRunDto> {
  if (dateOnly(input.endDate) < dateOnly(input.startDate)) {
    throw new PayrollServiceError("Payroll period end date must be after start date.");
  }

  const db = getDb();
  const run = await db.$transaction(async (tx) => {
    const approvedTimesheets = await tx.timesheet.findMany({
      where: approvedTimesheetWhere(input.startDate, input.endDate),
      include: {
        employeeProfile: true
      },
      orderBy: [{ employeeProfile: { displayName: "asc" } }, { periodStart: "asc" }]
    });
    if (!approvedTimesheets.length) {
      throw new PayrollServiceError("No approved timesheets found for this payroll period.");
    }

    const period = await tx.payrollPeriod.upsert({
      where: {
        periodStart_periodEnd: {
          periodStart: dateOnly(input.startDate),
          periodEnd: dateOnly(input.endDate)
        }
      },
      create: {
        periodStart: dateOnly(input.startDate),
        periodEnd: dateOnly(input.endDate),
        label: `${formatDateLabel(input.startDate)} - ${formatDateLabel(input.endDate)}`
      },
      update: {
        label: `${formatDateLabel(input.startDate)} - ${formatDateLabel(input.endDate)}`
      }
    });

    const payrollRun = await tx.payrollRun.upsert({
      where: { periodId: period.id },
      create: {
        periodId: period.id,
        generatedById: context.staffId ?? null,
        note: input.note
      },
      update: {
        status: "DRAFT",
        generatedById: context.staffId ?? null,
        reviewedAt: null,
        approvedAt: null,
        note: input.note
      }
    });

    const approvedTimesheetIds = approvedTimesheets.map((timesheet) => timesheet.id);
    await tx.payrollLine.deleteMany({
      where: {
        runId: payrollRun.id,
        timesheetId: { notIn: approvedTimesheetIds }
      }
    });

    for (const timesheet of approvedTimesheets) {
      const calculation = calculatePayrollLine(timesheet);
      const line = await tx.payrollLine.upsert({
        where: {
          runId_employeeProfileId_timesheetId: {
            runId: payrollRun.id,
            employeeProfileId: timesheet.employeeProfileId,
            timesheetId: timesheet.id
          }
        },
        create: {
          runId: payrollRun.id,
          employeeProfileId: timesheet.employeeProfileId,
          timesheetId: timesheet.id,
          ...calculation
        },
        update: calculation
      });
      await recalculatePayrollLineTotals(tx, line.id);
    }

    return findPayrollRunOrThrow(tx, payrollRun.id);
  });

  return mapPayrollRun(run);
}

export async function reviewPayrollRun(input: ReviewPayrollRunInput, context: StaffContext = {}): Promise<PayrollRunDto> {
  const db = getDb();
  const run = await db.$transaction(async (tx) => {
    const existing = await tx.payrollRun.findUniqueOrThrow({
      where: { id: input.runId },
      include: { lines: true }
    });
    if (!existing.lines.length) {
      throw new PayrollServiceError("Payroll run has no lines to review.");
    }

    const now = new Date();
    const status = input.action === "approve" ? "APPROVED" : input.action === "mark_reviewed" ? "REVIEWED" : "DRAFT";
    await tx.payrollRun.update({
      where: { id: existing.id },
      data: {
        status,
        note: input.note,
        generatedById: context.staffId ?? existing.generatedById,
        reviewedAt: input.action === "mark_reviewed" || input.action === "approve" ? (existing.reviewedAt ?? now) : null,
        approvedAt: input.action === "approve" ? now : null
      }
    });

    return findPayrollRunOrThrow(tx, existing.id);
  });

  return mapPayrollRun(run);
}

export async function createPayrollAdjustment(input: CreatePayrollAdjustmentInput, context: StaffContext = {}): Promise<PayrollRunDto> {
  const db = getDb();
  const run = await db.$transaction(async (tx) => {
    const line = await tx.payrollLine.findUniqueOrThrow({
      where: { id: input.lineId },
      include: { run: true }
    });
    if (line.run.status === "APPROVED") {
      throw new PayrollServiceError("Approved payroll runs cannot be adjusted. Reopen the run first.");
    }

    await tx.payrollAdjustment.create({
      data: {
        lineId: line.id,
        adjustmentType: input.adjustmentType,
        amountVnd: BigInt(input.amountVnd),
        reason: input.reason,
        createdById: context.staffId ?? null
      }
    });
    await recalculatePayrollLineTotals(tx, line.id);
    return findPayrollRunOrThrow(tx, line.runId);
  });

  return mapPayrollRun(run);
}

const payrollRunInclude = {
  period: true,
  lines: {
    include: {
      employeeProfile: true,
      timesheet: true,
      adjustments: {
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: {
      employeeProfile: {
        displayName: "asc"
      }
    }
  }
} satisfies Prisma.PayrollRunInclude;

async function findPayrollRunOrThrow(tx: Prisma.TransactionClient, runId: string) {
  return tx.payrollRun.findUniqueOrThrow({
    where: { id: runId },
    include: payrollRunInclude
  });
}

async function recalculatePayrollLineTotals(tx: Prisma.TransactionClient, lineId: string) {
  const line = await tx.payrollLine.findUniqueOrThrow({
    where: { id: lineId },
    include: { adjustments: true }
  });
  const bonusVnd = line.adjustments
    .filter((adjustment) => adjustment.adjustmentType === "BONUS")
    .reduce((total, adjustment) => total + adjustment.amountVnd, 0n);
  const deductionVnd = line.adjustments
    .filter((adjustment) => adjustment.adjustmentType === "DEDUCTION")
    .reduce((total, adjustment) => total + adjustment.amountVnd, 0n);
  const grossPayVnd = line.regularPayVnd + line.fixedPayVnd + line.overtimePayVnd + bonusVnd;
  const netPayVnd = grossPayVnd - deductionVnd;

  await tx.payrollLine.update({
    where: { id: line.id },
    data: {
      bonusVnd,
      deductionVnd,
      grossPayVnd,
      netPayVnd
    }
  });
}

function calculatePayrollLine(
  timesheet: Prisma.TimesheetGetPayload<{ include: { employeeProfile: true } }>
): Pick<
  Prisma.PayrollLineUncheckedCreateInput,
  | "approvedWorkedMinutes"
  | "regularMinutes"
  | "overtimeMinutes"
  | "hourlyRateVnd"
  | "fixedSalaryVnd"
  | "overtimeMultiplier"
  | "regularPayVnd"
  | "fixedPayVnd"
  | "overtimePayVnd"
  | "calculationMetadata"
> {
  const metadata = isRecord(timesheet.employeeProfile.salaryMetadata) ? timesheet.employeeProfile.salaryMetadata : {};
  const hourlyRateVnd = toNullableNumber(timesheet.employeeProfile.hourlyRateVnd);
  const fixedSalaryVnd = getMetadataNumber(metadata, ["fixedSalaryVnd", "monthlySalaryVnd", "baseSalaryVnd"]);
  const overtimeMultiplier = getMetadataNumber(metadata, ["overtimeMultiplier"]) ?? DEFAULT_OVERTIME_MULTIPLIER;
  const overtimeHourlyRateVnd = getMetadataNumber(metadata, ["overtimeHourlyRateVnd"]) ?? hourlyRateVnd ?? 0;
  const overtimeMinutes = Math.max(0, timesheet.overtimeMinutes);
  const regularMinutes = Math.max(0, timesheet.totalWorkedMinutes - overtimeMinutes);
  const regularPayVnd = hourlyRateVnd ? moneyForMinutes(regularMinutes, hourlyRateVnd) : 0;
  const fixedPayVnd = fixedSalaryVnd ?? 0;
  const overtimePayVnd = moneyForMinutes(overtimeMinutes, overtimeHourlyRateVnd, overtimeMultiplier);
  const notes = [
    "Uses approved timesheet totals only.",
    hourlyRateVnd ? `Hourly rate: ${hourlyRateVnd} VND.` : "No hourly rate configured.",
    fixedSalaryVnd ? `Fixed salary: ${fixedSalaryVnd} VND.` : "No fixed salary configured.",
    overtimeMinutes ? `Overtime multiplier: ${overtimeMultiplier}.` : "No overtime in approved timesheet."
  ];

  return {
    approvedWorkedMinutes: timesheet.totalWorkedMinutes,
    regularMinutes,
    overtimeMinutes,
    hourlyRateVnd: hourlyRateVnd === null ? null : BigInt(hourlyRateVnd),
    fixedSalaryVnd: fixedSalaryVnd === null ? null : BigInt(fixedSalaryVnd),
    overtimeMultiplier: new Prisma.Decimal(overtimeMultiplier),
    regularPayVnd: BigInt(regularPayVnd),
    fixedPayVnd: BigInt(fixedPayVnd),
    overtimePayVnd: BigInt(overtimePayVnd),
    calculationMetadata: {
      notes,
      source: {
        timesheetId: timesheet.id,
        timesheetStatus: timesheet.status,
        periodStart: dateInputValue(timesheet.periodStart),
        periodEnd: dateInputValue(timesheet.periodEnd),
        totalBreakMinutes: timesheet.totalBreakMinutes,
        lateMinutes: timesheet.lateMinutes,
        earlyLeaveMinutes: timesheet.earlyLeaveMinutes,
        exceptionCount: timesheet.exceptionCount
      }
    }
  };
}

function approvedTimesheetWhere(startDate: string, endDate: string): Prisma.TimesheetWhereInput {
  return {
    status: "APPROVED",
    periodStart: { gte: dateOnly(startDate) },
    periodEnd: { lte: dateOnly(endDate) }
  };
}

function mapPayrollRun(run: PayrollRunRecord): PayrollRunDto {
  return {
    id: run.id,
    status: run.status,
    generatedById: run.generatedById,
    reviewedAt: run.reviewedAt?.toISOString() ?? null,
    approvedAt: run.approvedAt?.toISOString() ?? null,
    note: run.note,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    period: mapPayrollPeriod(run.period),
    lines: run.lines.map(mapPayrollLine)
  };
}

function mapPayrollPeriod(period: Prisma.PayrollPeriodGetPayload<Record<string, never>>): PayrollPeriodDto {
  return {
    id: period.id,
    startDate: dateInputValue(period.periodStart),
    endDate: dateInputValue(period.periodEnd),
    label: period.label
  };
}

function mapPayrollLine(line: PayrollLineRecord): PayrollLineDto {
  return {
    id: line.id,
    employeeProfileId: line.employeeProfileId,
    employeeName: line.employeeProfile.displayName,
    employeeCode: line.employeeProfile.employeeCode,
    scheduleRole: line.employeeProfile.scheduleRole,
    timesheetId: line.timesheetId,
    approvedWorkedMinutes: line.approvedWorkedMinutes,
    regularMinutes: line.regularMinutes,
    overtimeMinutes: line.overtimeMinutes,
    hourlyRateVnd: toNullableNumber(line.hourlyRateVnd),
    fixedSalaryVnd: toNullableNumber(line.fixedSalaryVnd),
    overtimeMultiplier: Number(line.overtimeMultiplier),
    regularPayVnd: toNumber(line.regularPayVnd),
    fixedPayVnd: toNumber(line.fixedPayVnd),
    overtimePayVnd: toNumber(line.overtimePayVnd),
    bonusVnd: toNumber(line.bonusVnd),
    deductionVnd: toNumber(line.deductionVnd),
    grossPayVnd: toNumber(line.grossPayVnd),
    netPayVnd: toNumber(line.netPayVnd),
    calculationNotes: getCalculationNotes(line.calculationMetadata),
    adjustments: line.adjustments.map(mapPayrollAdjustment)
  };
}

function mapPayrollAdjustment(adjustment: Prisma.PayrollAdjustmentGetPayload<Record<string, never>>): PayrollAdjustmentDto {
  return {
    id: adjustment.id,
    lineId: adjustment.lineId,
    adjustmentType: adjustment.adjustmentType,
    amountVnd: toNumber(adjustment.amountVnd),
    reason: adjustment.reason,
    createdAt: adjustment.createdAt.toISOString()
  };
}

function summarizeLines(lines: PayrollLineDto[]): PayrollSnapshotDto["summary"] {
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

function resolvePayrollPeriod(input: Partial<PayrollQueryInput>) {
  const today = toBangkokDateInputValue(new Date());
  const startDate = input.startDate ?? startOfBangkokMonthInput(today);
  const endDate = input.endDate ?? endOfBangkokMonthInput(startDate);
  return { startDate, endDate };
}

function moneyForMinutes(minutes: number, hourlyRateVnd: number, multiplier = 1) {
  return Math.round((minutes / 60) * hourlyRateVnd * multiplier);
}

function getCalculationNotes(value: Prisma.JsonValue) {
  if (!isRecord(value) || !Array.isArray(value.notes)) return [];
  return value.notes.filter((note): note is string => typeof note === "string");
}

function getMetadataNumber(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

function startOfBangkokMonthInput(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function endOfBangkokMonthInput(value: string) {
  const [year, month] = value.split("-").map(Number);
  return dateInputValue(new Date(Date.UTC(year, month, 0)));
}

function dateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateInputValue(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function toBangkokDateInputValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  return dateOnly(value).toLocaleDateString("vi-VN", { timeZone: TIME_ZONE });
}

function toNullableNumber(value: bigint | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return typeof value === "bigint" ? Number(value) : value;
}

function toNumber(value: bigint | number) {
  return typeof value === "bigint" ? Number(value) : value;
}

function sum<T>(rows: T[], getValue: (row: T) => number) {
  return rows.reduce((total, row) => total + getValue(row), 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
