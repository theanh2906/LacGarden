import type { UserRole } from "@prisma/client";

export type EmployeeEmploymentStatus = "ACTIVE" | "ON_LEAVE" | "TERMINATED";
export type StaffScheduleRole = "BAR" | "CASHIER" | "SERVICE" | "MANAGER";
export type StaffScheduleStatus = "SCHEDULED" | "CONFIRMED" | "CANCELLED";
export type TimeClockEntryStatus = "OPEN" | "CLOSED" | "MISSED_PUNCH" | "NEEDS_REVIEW" | "APPROVED";
export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type TimesheetAdjustmentType = "TIME_CORRECTION" | "BREAK_CORRECTION" | "MANAGER_NOTE";
export type TimeClockExceptionCode = "LATE_ARRIVAL" | "EARLY_LEAVE" | "OVERTIME" | "MISSED_CLOCK_OUT" | "MISSED_CLOCK_IN";

export type EmployeeProfileDto = {
  id: string;
  userId: string | null;
  employeeCode: string | null;
  displayName: string;
  role: UserRole;
  scheduleRole: StaffScheduleRole;
  phone: string | null;
  email: string | null;
  employmentStatus: EmployeeEmploymentStatus;
  hourlyRateVnd: number | null;
  salaryMetadata: Record<string, unknown> | null;
  hiredAt: string | null;
  terminatedAt: string | null;
  note: string | null;
  updatedAt: string;
};

export type StaffScheduleDto = {
  id: string;
  employeeProfileId: string;
  employeeName: string;
  scheduleDate: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  role: StaffScheduleRole;
  status: StaffScheduleStatus;
  note: string | null;
};

export type TimeClockEntryDto = {
  id: string;
  employeeProfileId: string;
  employeeName: string;
  scheduleId: string | null;
  clockInAt: string;
  clockOutAt: string | null;
  breakMinutes: number;
  status: TimeClockEntryStatus;
  exceptions: TimeClockExceptionCode[];
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  missedPunch: boolean;
  workedMinutes: number;
  note: string | null;
};

export type TimesheetAdjustmentDto = {
  id: string;
  timesheetId: string;
  employeeProfileId: string;
  adjustmentType: TimesheetAdjustmentType;
  minutesDelta: number;
  reason: string;
  createdAt: string;
};

export type TimesheetDto = {
  id: string;
  employeeProfileId: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  status: TimesheetStatus;
  totalWorkedMinutes: number;
  totalBreakMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  exceptionCount: number;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  note: string | null;
  adjustments: TimesheetAdjustmentDto[];
};

export type StaffOpsPeriodDto = {
  startDate: string;
  endDate: string;
  label: string;
};

export type CurrentClockStateDto = {
  employeeProfile: EmployeeProfileDto;
  openEntry: TimeClockEntryDto | null;
  todaySchedule: StaffScheduleDto | null;
};

export type StaffOpsSnapshotDto = {
  period: StaffOpsPeriodDto;
  employees: EmployeeProfileDto[];
  schedules: StaffScheduleDto[];
  clockEntries: TimeClockEntryDto[];
  timesheets: TimesheetDto[];
  currentClock: CurrentClockStateDto | null;
  summary: {
    activeEmployees: number;
    scheduledShiftCount: number;
    openClockEntryCount: number;
    pendingApprovalCount: number;
    exceptionCount: number;
  };
};
