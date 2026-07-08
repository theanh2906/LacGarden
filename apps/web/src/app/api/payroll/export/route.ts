import * as XLSX from "xlsx";
import { requireStaffPermission } from "@/server/auth";
import { getPayrollSnapshot } from "@/server/payroll";
import { payrollExportQuerySchema } from "@/server/payroll-validation";
import type { PayrollLineDto, PayrollSnapshotDto } from "@/types/payroll";
import { toPayrollErrorResponse } from "../error-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireStaffPermission("payroll:manage");
    const query = payrollExportQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const snapshot = await getPayrollSnapshot(query);
    const filenameBase = `payroll-${snapshot.period.startDate}-${snapshot.period.endDate}`;

    if (query.format === "xlsx") {
      const workbook = buildWorkbook(snapshot);
      const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`
        }
      });
    }

    return new Response(`\uFEFF${buildCsv(snapshot)}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`
      }
    });
  } catch (error) {
    return toPayrollErrorResponse(error);
  }
}

function buildCsv(snapshot: PayrollSnapshotDto) {
  const rows: string[][] = [];
  rows.push(["Payroll period", snapshot.period.label]);
  rows.push(["Start", snapshot.period.startDate], ["End", snapshot.period.endDate], ["Status", snapshot.run?.status ?? "NOT_GENERATED"]);
  rows.push([]);
  rows.push(["Summary"]);
  rows.push(...Object.entries(snapshot.summary).map(([key, value]) => [key, String(value)]));
  rows.push([]);
  rows.push(lineHeaders());
  rows.push(...(snapshot.run?.lines ?? []).map(lineToRow));
  rows.push([]);
  rows.push(["Adjustments"]);
  rows.push(["Employee", "Type", "Amount VND", "Reason", "Created at"]);
  for (const line of snapshot.run?.lines ?? []) {
    for (const adjustment of line.adjustments) {
      rows.push([line.employeeName, adjustment.adjustmentType, String(adjustment.amountVnd), adjustment.reason, adjustment.createdAt]);
    }
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function buildWorkbook(snapshot: PayrollSnapshotDto) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      {
        period: snapshot.period.label,
        startDate: snapshot.period.startDate,
        endDate: snapshot.period.endDate,
        status: snapshot.run?.status ?? "NOT_GENERATED",
        approvedTimesheetCount: snapshot.approvedTimesheetCount,
        missingApprovedTimesheetCount: snapshot.missingApprovedTimesheetCount,
        ...snapshot.summary
      }
    ]),
    "Summary"
  );
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([lineHeaders(), ...(snapshot.run?.lines ?? []).map(lineToRow)]), "Payroll lines");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      (snapshot.run?.lines ?? []).flatMap((line) =>
        line.adjustments.map((adjustment) => ({
          employeeName: line.employeeName,
          employeeCode: line.employeeCode,
          adjustmentType: adjustment.adjustmentType,
          amountVnd: adjustment.amountVnd,
          reason: adjustment.reason,
          createdAt: adjustment.createdAt
        }))
      )
    ),
    "Adjustments"
  );
  return workbook;
}

function lineHeaders() {
  return [
    "Employee",
    "Code",
    "Role",
    "Approved hours",
    "Regular hours",
    "Overtime hours",
    "Hourly rate VND",
    "Fixed salary VND",
    "Regular pay VND",
    "Fixed pay VND",
    "Overtime pay VND",
    "Bonus VND",
    "Deduction VND",
    "Gross pay VND",
    "Net pay VND",
    "Notes"
  ];
}

function lineToRow(line: PayrollLineDto) {
  return [
    line.employeeName,
    line.employeeCode ?? "",
    line.scheduleRole,
    String(roundHours(line.approvedWorkedMinutes)),
    String(roundHours(line.regularMinutes)),
    String(roundHours(line.overtimeMinutes)),
    String(line.hourlyRateVnd ?? ""),
    String(line.fixedSalaryVnd ?? ""),
    String(line.regularPayVnd),
    String(line.fixedPayVnd),
    String(line.overtimePayVnd),
    String(line.bonusVnd),
    String(line.deductionVnd),
    String(line.grossPayVnd),
    String(line.netPayVnd),
    line.calculationNotes.join(" | ")
  ];
}

function roundHours(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
