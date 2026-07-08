export type PayrollRunStatus = "DRAFT" | "REVIEWED" | "APPROVED";
export type PayrollAdjustmentType = "BONUS" | "DEDUCTION";
export type PayrollExportFormat = "csv" | "xlsx";

export type PayrollPeriodDto = {
  id: string;
  startDate: string;
  endDate: string;
  label: string;
};

export type PayrollAdjustmentDto = {
  id: string;
  lineId: string;
  adjustmentType: PayrollAdjustmentType;
  amountVnd: number;
  reason: string;
  createdAt: string;
};

export type PayrollLineDto = {
  id: string;
  employeeProfileId: string;
  employeeName: string;
  employeeCode: string | null;
  scheduleRole: string;
  timesheetId: string;
  approvedWorkedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  hourlyRateVnd: number | null;
  fixedSalaryVnd: number | null;
  overtimeMultiplier: number;
  regularPayVnd: number;
  fixedPayVnd: number;
  overtimePayVnd: number;
  bonusVnd: number;
  deductionVnd: number;
  grossPayVnd: number;
  netPayVnd: number;
  calculationNotes: string[];
  adjustments: PayrollAdjustmentDto[];
};

export type PayrollRunDto = {
  id: string;
  status: PayrollRunStatus;
  generatedById: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  period: PayrollPeriodDto;
  lines: PayrollLineDto[];
};

export type PayrollSnapshotDto = {
  period: PayrollPeriodDto;
  run: PayrollRunDto | null;
  approvedTimesheetCount: number;
  missingApprovedTimesheetCount: number;
  summary: {
    employeeCount: number;
    approvedWorkedMinutes: number;
    overtimeMinutes: number;
    regularPayVnd: number;
    fixedPayVnd: number;
    overtimePayVnd: number;
    bonusVnd: number;
    deductionVnd: number;
    grossPayVnd: number;
    netPayVnd: number;
  };
};
