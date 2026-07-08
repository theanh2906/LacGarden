import { Prisma, type UserRole } from "@prisma/client";
import { getDb } from "@/server/db";
import type {
  ClockOutInput,
  CreateTimesheetAdjustmentInput,
  StaffOpsQueryInput,
  TimesheetActionInput,
  UpsertEmployeeProfileInput,
  UpsertStaffScheduleInput
} from "@/server/staff-ops-validation";
import type {
  CurrentClockStateDto,
  EmployeeProfileDto,
  StaffOpsSnapshotDto,
  StaffScheduleDto,
  TimeClockEntryDto,
  TimeClockExceptionCode,
  TimesheetAdjustmentDto,
  TimesheetDto
} from "@/types/staff-ops";

const TIME_ZONE = "Asia/Bangkok";
const LATE_GRACE_MINUTES = 5;
const EARLY_LEAVE_GRACE_MINUTES = 5;
const OVERTIME_GRACE_MINUTES = 15;
const MISSED_CLOCK_OUT_HOURS = 16;

type StaffContext = {
  staffId?: string;
};

type EmployeeProfileRecord = Prisma.EmployeeProfileGetPayload<{ include: { user: true } }>;
type StaffScheduleRecord = Prisma.StaffScheduleGetPayload<{ include: { employeeProfile: true } }>;
type TimeClockRecord = Prisma.TimeClockEntryGetPayload<{ include: { employeeProfile: true; schedule: true } }>;
type TimesheetRecord = Prisma.TimesheetGetPayload<{ include: { employeeProfile: true; adjustments: true } }>;

export class StaffOpsServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffOpsServiceError";
  }
}

export function getStaffOpsErrorMessage(error: unknown) {
  if (error instanceof StaffOpsServiceError) return error.message;
  return "Staff operation failed. Check admin logs for details.";
}

export async function getStaffOpsSnapshot(input: Partial<StaffOpsQueryInput> = {}, context: StaffContext = {}): Promise<StaffOpsSnapshotDto> {
  const period = resolveStaffOpsPeriod(input);
  const db = getDb();
  const [employees, schedules, clockEntries, timesheets, currentClock] = await Promise.all([
    db.employeeProfile.findMany({
      include: { user: true },
      orderBy: [{ employmentStatus: "asc" }, { displayName: "asc" }]
    }),
    db.staffSchedule.findMany({
      where: {
        scheduleDate: {
          gte: dateOnly(period.startDate),
          lte: dateOnly(period.endDate)
        }
      },
      include: { employeeProfile: true },
      orderBy: [{ scheduleDate: "asc" }, { scheduledStartAt: "asc" }]
    }),
    db.timeClockEntry.findMany({
      where: {
        clockInAt: {
          gte: bangkokDateStart(period.startDate),
          lt: addBangkokDays(bangkokDateStart(period.endDate), 1)
        }
      },
      include: {
        employeeProfile: true,
        schedule: true
      },
      orderBy: { clockInAt: "desc" }
    }),
    db.timesheet.findMany({
      where: {
        periodStart: { gte: dateOnly(period.startDate) },
        periodEnd: { lte: dateOnly(period.endDate) }
      },
      include: {
        employeeProfile: true,
        adjustments: {
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: [{ status: "asc" }, { periodStart: "desc" }]
    }),
    context.staffId ? getCurrentStaffClockState(context.staffId) : Promise.resolve(null)
  ]);

  const clockDtos = clockEntries.map(mapTimeClockEntry);
  return {
    period: {
      startDate: period.startDate,
      endDate: period.endDate,
      label: `${formatDateLabel(bangkokDateStart(period.startDate))} - ${formatDateLabel(bangkokDateStart(period.endDate))}`
    },
    employees: employees.map(mapEmployeeProfile),
    schedules: schedules.map(mapStaffSchedule),
    clockEntries: clockDtos,
    timesheets: timesheets.map(mapTimesheet),
    currentClock,
    summary: {
      activeEmployees: employees.filter((employee) => employee.employmentStatus === "ACTIVE").length,
      scheduledShiftCount: schedules.filter((schedule) => schedule.status !== "CANCELLED").length,
      openClockEntryCount: clockDtos.filter((entry) => entry.status === "OPEN").length,
      pendingApprovalCount: timesheets.filter((timesheet) => timesheet.status === "SUBMITTED").length,
      exceptionCount: clockDtos.reduce((total, entry) => total + entry.exceptions.length, 0)
    }
  };
}

export async function upsertEmployeeProfile(input: UpsertEmployeeProfileInput): Promise<EmployeeProfileDto> {
  const db = getDb();
  const salaryMetadata =
    input.salaryMetadata === undefined
      ? undefined
      : input.salaryMetadata === null
        ? Prisma.JsonNull
        : (input.salaryMetadata as Prisma.InputJsonValue);
  const data = {
    userId: input.userId ?? null,
    employeeCode: input.employeeCode,
    displayName: input.displayName,
    role: input.role,
    scheduleRole: input.scheduleRole,
    phone: input.phone,
    email: input.email,
    employmentStatus: input.employmentStatus,
    hourlyRateVnd: input.hourlyRateVnd === null || input.hourlyRateVnd === undefined ? null : BigInt(input.hourlyRateVnd),
    ...(salaryMetadata !== undefined ? { salaryMetadata } : {}),
    hiredAt: input.hiredAt ? bangkokDateStart(input.hiredAt) : null,
    terminatedAt: input.terminatedAt ? bangkokDateStart(input.terminatedAt) : null,
    note: input.note
  };

  const profile = input.id
    ? await db.employeeProfile.update({
        where: { id: input.id },
        data,
        include: { user: true }
      })
    : await db.employeeProfile.create({
        data,
        include: { user: true }
      });

  return mapEmployeeProfile(profile);
}

export async function upsertStaffSchedule(input: UpsertStaffScheduleInput, context: StaffContext = {}): Promise<StaffScheduleDto> {
  const db = getDb();
  const start = localDateTime(input.scheduleDate, input.startTime);
  const end = localDateTime(input.scheduleDate, input.endTime, start);
  if (end <= start) {
    throw new StaffOpsServiceError("Schedule end time must be after start time.");
  }

  const data = {
    employeeProfileId: input.employeeProfileId,
    scheduleDate: dateOnly(input.scheduleDate),
    scheduledStartAt: start,
    scheduledEndAt: end,
    role: input.role,
    status: input.status,
    note: input.note,
    createdById: context.staffId ?? null
  };

  const schedule = input.id
    ? await db.staffSchedule.update({
        where: { id: input.id },
        data,
        include: { employeeProfile: true }
      })
    : await db.staffSchedule.create({
        data,
        include: { employeeProfile: true }
      });

  return mapStaffSchedule(schedule);
}

export async function clockIn(context: Required<StaffContext>): Promise<CurrentClockStateDto> {
  const db = getDb();
  await db.$transaction(async (tx) => {
    const profile = await ensureEmployeeProfileForUser(tx, context.staffId);
    if (profile.employmentStatus !== "ACTIVE") {
      throw new StaffOpsServiceError("Only active staff can clock in.");
    }
    const openEntry = await tx.timeClockEntry.findFirst({
      where: {
        employeeProfileId: profile.id,
        status: "OPEN"
      }
    });
    if (openEntry) {
      throw new StaffOpsServiceError("You already have an open clock-in entry.");
    }

    const now = new Date();
    const schedule = await findNearestSchedule(tx, profile.id, now);
    const metrics = calculateClockMetrics({ schedule, clockInAt: now, clockOutAt: null, breakMinutes: 0 });
    await tx.timeClockEntry.create({
      data: {
        employeeProfileId: profile.id,
        userId: context.staffId,
        scheduleId: schedule?.id ?? null,
        clockInAt: now,
        status: "OPEN",
        exceptions: metrics.exceptions,
        lateMinutes: metrics.lateMinutes,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        missedPunch: false
      }
    });
  });

  return getCurrentStaffClockState(context.staffId).then((state) => {
    if (!state) throw new StaffOpsServiceError("Unable to load current clock state.");
    return state;
  });
}

export async function clockOut(input: ClockOutInput, context: Required<StaffContext>): Promise<CurrentClockStateDto> {
  const db = getDb();
  await db.$transaction(async (tx) => {
    const profile = await ensureEmployeeProfileForUser(tx, context.staffId);
    const entry = await tx.timeClockEntry.findFirst({
      where: {
        employeeProfileId: profile.id,
        status: "OPEN"
      },
      include: {
        schedule: true
      },
      orderBy: { clockInAt: "desc" }
    });
    if (!entry) {
      throw new StaffOpsServiceError("No open clock-in entry found.");
    }

    const clockOutAt = new Date();
    const metrics = calculateClockMetrics({
      schedule: entry.schedule,
      clockInAt: entry.clockInAt,
      clockOutAt,
      breakMinutes: input.breakMinutes
    });
    await tx.timeClockEntry.update({
      where: { id: entry.id },
      data: {
        clockOutAt,
        breakMinutes: input.breakMinutes,
        status: metrics.needsReview ? "NEEDS_REVIEW" : "CLOSED",
        exceptions: metrics.exceptions,
        lateMinutes: metrics.lateMinutes,
        earlyLeaveMinutes: metrics.earlyLeaveMinutes,
        overtimeMinutes: metrics.overtimeMinutes,
        missedPunch: metrics.exceptions.includes("MISSED_CLOCK_OUT"),
        note: input.note
      }
    });
  });

  return getCurrentStaffClockState(context.staffId).then((state) => {
    if (!state) throw new StaffOpsServiceError("Unable to load current clock state.");
    return state;
  });
}

export async function runTimesheetAction(input: TimesheetActionInput, context: StaffContext = {}): Promise<TimesheetDto> {
  const db = getDb();
  const result = await db.$transaction(async (tx) => {
    const timesheet = await upsertTimesheetFromClockEntries(tx, input.employeeProfileId, input.periodStart, input.periodEnd);
    const now = new Date();
    const status = input.action === "submit" ? "SUBMITTED" : input.action === "approve" ? "APPROVED" : "REJECTED";
    return tx.timesheet.update({
      where: { id: timesheet.id },
      data: {
        status,
        note: input.note,
        ...(input.action === "submit" ? { submittedAt: timesheet.submittedAt ?? now } : {}),
        ...(input.action === "approve" ? { approvedAt: now, approvedById: context.staffId ?? null } : {}),
        ...(input.action === "reject" ? { approvedAt: null, approvedById: null } : {})
      },
      include: {
        employeeProfile: true,
        adjustments: {
          orderBy: { createdAt: "desc" }
        }
      }
    });
  });

  return mapTimesheet(result);
}

export async function createTimesheetAdjustment(input: CreateTimesheetAdjustmentInput, context: StaffContext = {}): Promise<TimesheetDto> {
  const db = getDb();
  const timesheet = await db.$transaction(async (tx) => {
    const existing = await tx.timesheet.findUniqueOrThrow({
      where: { id: input.timesheetId }
    });
    await tx.timesheetAdjustment.create({
      data: {
        timesheetId: existing.id,
        employeeProfileId: existing.employeeProfileId,
        adjustmentType: input.adjustmentType,
        minutesDelta: input.minutesDelta,
        reason: input.reason,
        createdById: context.staffId ?? null
      }
    });
    await recalculateTimesheetTotals(tx, existing.id);
    return tx.timesheet.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        employeeProfile: true,
        adjustments: {
          orderBy: { createdAt: "desc" }
        }
      }
    });
  });

  return mapTimesheet(timesheet);
}

export async function getCurrentStaffClockState(staffId: string): Promise<CurrentClockStateDto | null> {
  const db = getDb();
  const profile = await db.employeeProfile.findFirst({
    where: { userId: staffId },
    include: { user: true }
  });
  if (!profile) return null;

  const [openEntry, todaySchedule] = await Promise.all([
    db.timeClockEntry.findFirst({
      where: {
        employeeProfileId: profile.id,
        status: "OPEN"
      },
      include: {
        employeeProfile: true,
        schedule: true
      },
      orderBy: { clockInAt: "desc" }
    }),
    db.staffSchedule.findFirst({
      where: {
        employeeProfileId: profile.id,
        scheduleDate: dateOnly(toBangkokDateInputValue(new Date())),
        status: { not: "CANCELLED" }
      },
      include: {
        employeeProfile: true
      },
      orderBy: { scheduledStartAt: "asc" }
    })
  ]);

  return {
    employeeProfile: mapEmployeeProfile(profile),
    openEntry: openEntry ? mapTimeClockEntry(openEntry) : null,
    todaySchedule: todaySchedule ? mapStaffSchedule(todaySchedule) : null
  };
}

async function ensureEmployeeProfileForUser(tx: Prisma.TransactionClient, staffId: string) {
  const existing = await tx.employeeProfile.findFirst({
    where: { userId: staffId }
  });
  if (existing) return existing;

  const user = await tx.user.findUniqueOrThrow({
    where: { id: staffId }
  });
  return tx.employeeProfile.create({
    data: {
      userId: user.id,
      displayName: user.displayName,
      role: user.role,
      scheduleRole: roleToScheduleRole(user.role),
      employmentStatus: user.isActive ? "ACTIVE" : "TERMINATED",
      hiredAt: bangkokDateStart(toBangkokDateInputValue(user.createdAt))
    }
  });
}

async function findNearestSchedule(tx: Prisma.TransactionClient, employeeProfileId: string, now: Date) {
  const today = toBangkokDateInputValue(now);
  return tx.staffSchedule.findFirst({
    where: {
      employeeProfileId,
      scheduleDate: dateOnly(today),
      status: { not: "CANCELLED" }
    },
    orderBy: {
      scheduledStartAt: "asc"
    }
  });
}

async function upsertTimesheetFromClockEntries(tx: Prisma.TransactionClient, employeeProfileId: string, periodStart: string, periodEnd: string) {
  const start = dateOnly(periodStart);
  const end = dateOnly(periodEnd);
  const existing = await tx.timesheet.upsert({
    where: {
      employeeProfileId_periodStart_periodEnd: {
        employeeProfileId,
        periodStart: start,
        periodEnd: end
      }
    },
    create: {
      employeeProfileId,
      periodStart: start,
      periodEnd: end
    },
    update: {}
  });
  await recalculateTimesheetTotals(tx, existing.id);
  return tx.timesheet.findUniqueOrThrow({ where: { id: existing.id } });
}

async function recalculateTimesheetTotals(tx: Prisma.TransactionClient, timesheetId: string) {
  const timesheet = await tx.timesheet.findUniqueOrThrow({
    where: { id: timesheetId },
    include: {
      adjustments: true
    }
  });
  const entries = await tx.timeClockEntry.findMany({
    where: {
      employeeProfileId: timesheet.employeeProfileId,
      clockInAt: {
        gte: bangkokDateStart(dateInputValue(timesheet.periodStart)),
        lt: addBangkokDays(bangkokDateStart(dateInputValue(timesheet.periodEnd)), 1)
      }
    }
  });

  const adjustmentMinutes = timesheet.adjustments.reduce((total, adjustment) => total + adjustment.minutesDelta, 0);
  const totalWorkedMinutes =
    entries.reduce((total, entry) => total + getWorkedMinutes(entry.clockInAt, entry.clockOutAt, entry.breakMinutes), 0) + adjustmentMinutes;
  const totalBreakMinutes = entries.reduce((total, entry) => total + entry.breakMinutes, 0);
  const exceptionCount = entries.reduce((total, entry) => total + parseExceptions(entry.exceptions).length, 0);

  await tx.timesheet.update({
    where: { id: timesheet.id },
    data: {
      totalWorkedMinutes,
      totalBreakMinutes,
      lateMinutes: entries.reduce((total, entry) => total + entry.lateMinutes, 0),
      earlyLeaveMinutes: entries.reduce((total, entry) => total + entry.earlyLeaveMinutes, 0),
      overtimeMinutes: entries.reduce((total, entry) => total + entry.overtimeMinutes, 0),
      exceptionCount
    }
  });
}

function calculateClockMetrics({
  schedule,
  clockInAt,
  clockOutAt,
  breakMinutes
}: {
  schedule: { scheduledStartAt: Date; scheduledEndAt: Date } | null;
  clockInAt: Date;
  clockOutAt: Date | null;
  breakMinutes: number;
}) {
  const exceptions: TimeClockExceptionCode[] = [];
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let overtimeMinutes = 0;

  if (schedule) {
    lateMinutes = Math.max(0, diffMinutes(clockInAt, schedule.scheduledStartAt));
    if (lateMinutes <= LATE_GRACE_MINUTES) lateMinutes = 0;
    if (lateMinutes > 0) exceptions.push("LATE_ARRIVAL");

    if (clockOutAt) {
      earlyLeaveMinutes = Math.max(0, diffMinutes(schedule.scheduledEndAt, clockOutAt));
      if (earlyLeaveMinutes <= EARLY_LEAVE_GRACE_MINUTES) earlyLeaveMinutes = 0;
      if (earlyLeaveMinutes > 0) exceptions.push("EARLY_LEAVE");

      overtimeMinutes = Math.max(0, diffMinutes(clockOutAt, schedule.scheduledEndAt));
      if (overtimeMinutes <= OVERTIME_GRACE_MINUTES) overtimeMinutes = 0;
      if (overtimeMinutes > 0) exceptions.push("OVERTIME");
    }
  }

  if (clockOutAt && clockOutAt <= clockInAt) {
    exceptions.push("MISSED_CLOCK_OUT");
  }
  if (breakMinutes < 0) {
    exceptions.push("MISSED_CLOCK_IN");
  }

  return {
    exceptions: Array.from(new Set(exceptions)),
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    needsReview: exceptions.length > 0
  };
}

function mapEmployeeProfile(profile: EmployeeProfileRecord | Prisma.EmployeeProfileGetPayload<Record<string, never>>): EmployeeProfileDto {
  return {
    id: profile.id,
    userId: profile.userId,
    employeeCode: profile.employeeCode,
    displayName: profile.displayName,
    role: profile.role,
    scheduleRole: profile.scheduleRole,
    phone: profile.phone,
    email: profile.email,
    employmentStatus: profile.employmentStatus,
    hourlyRateVnd: toNullableNumber(profile.hourlyRateVnd),
    salaryMetadata: isRecord(profile.salaryMetadata) ? profile.salaryMetadata : null,
    hiredAt: profile.hiredAt?.toISOString() ?? null,
    terminatedAt: profile.terminatedAt?.toISOString() ?? null,
    note: profile.note,
    updatedAt: profile.updatedAt.toISOString()
  };
}

function mapStaffSchedule(schedule: StaffScheduleRecord): StaffScheduleDto {
  return {
    id: schedule.id,
    employeeProfileId: schedule.employeeProfileId,
    employeeName: schedule.employeeProfile.displayName,
    scheduleDate: dateInputValue(schedule.scheduleDate),
    scheduledStartAt: schedule.scheduledStartAt.toISOString(),
    scheduledEndAt: schedule.scheduledEndAt.toISOString(),
    role: schedule.role,
    status: schedule.status,
    note: schedule.note
  };
}

function mapTimeClockEntry(entry: TimeClockRecord): TimeClockEntryDto {
  const exceptions = parseExceptions(entry.exceptions);
  const missedClockOut = !entry.clockOutAt && diffMinutes(new Date(), entry.clockInAt) >= MISSED_CLOCK_OUT_HOURS * 60;
  const mergedExceptions = missedClockOut ? Array.from(new Set([...exceptions, "MISSED_CLOCK_OUT" as const])) : exceptions;
  return {
    id: entry.id,
    employeeProfileId: entry.employeeProfileId,
    employeeName: entry.employeeProfile.displayName,
    scheduleId: entry.scheduleId,
    clockInAt: entry.clockInAt.toISOString(),
    clockOutAt: entry.clockOutAt?.toISOString() ?? null,
    breakMinutes: entry.breakMinutes,
    status: missedClockOut && entry.status === "OPEN" ? "MISSED_PUNCH" : entry.status,
    exceptions: mergedExceptions,
    lateMinutes: entry.lateMinutes,
    earlyLeaveMinutes: entry.earlyLeaveMinutes,
    overtimeMinutes: entry.overtimeMinutes,
    missedPunch: entry.missedPunch || missedClockOut,
    workedMinutes: getWorkedMinutes(entry.clockInAt, entry.clockOutAt, entry.breakMinutes),
    note: entry.note
  };
}

function mapTimesheet(timesheet: TimesheetRecord): TimesheetDto {
  return {
    id: timesheet.id,
    employeeProfileId: timesheet.employeeProfileId,
    employeeName: timesheet.employeeProfile.displayName,
    periodStart: dateInputValue(timesheet.periodStart),
    periodEnd: dateInputValue(timesheet.periodEnd),
    status: timesheet.status,
    totalWorkedMinutes: timesheet.totalWorkedMinutes,
    totalBreakMinutes: timesheet.totalBreakMinutes,
    lateMinutes: timesheet.lateMinutes,
    earlyLeaveMinutes: timesheet.earlyLeaveMinutes,
    overtimeMinutes: timesheet.overtimeMinutes,
    exceptionCount: timesheet.exceptionCount,
    submittedAt: timesheet.submittedAt?.toISOString() ?? null,
    approvedAt: timesheet.approvedAt?.toISOString() ?? null,
    approvedById: timesheet.approvedById,
    note: timesheet.note,
    adjustments: timesheet.adjustments.map(mapTimesheetAdjustment)
  };
}

function mapTimesheetAdjustment(adjustment: Prisma.TimesheetAdjustmentGetPayload<Record<string, never>>): TimesheetAdjustmentDto {
  return {
    id: adjustment.id,
    timesheetId: adjustment.timesheetId,
    employeeProfileId: adjustment.employeeProfileId,
    adjustmentType: adjustment.adjustmentType,
    minutesDelta: adjustment.minutesDelta,
    reason: adjustment.reason,
    createdAt: adjustment.createdAt.toISOString()
  };
}

function resolveStaffOpsPeriod(input: Partial<StaffOpsQueryInput>) {
  const today = toBangkokDateInputValue(new Date());
  const startDate = input.startDate ?? startOfBangkokWeekInput(today);
  const endDate = input.endDate ?? dateInputValue(addBangkokDays(bangkokDateStart(startDate), 6));
  return { startDate, endDate };
}

function roleToScheduleRole(role: UserRole) {
  if (role === "MANAGER" || role === "OWNER") return "MANAGER";
  if (role === "CASHIER") return "CASHIER";
  if (role === "BARISTA") return "BAR";
  return "SERVICE";
}

function getWorkedMinutes(clockInAt: Date, clockOutAt: Date | null, breakMinutes: number) {
  if (!clockOutAt || clockOutAt <= clockInAt) return 0;
  return Math.max(0, diffMinutes(clockOutAt, clockInAt) - breakMinutes);
}

function parseExceptions(value: Prisma.JsonValue): TimeClockExceptionCode[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<TimeClockExceptionCode>(["LATE_ARRIVAL", "EARLY_LEAVE", "OVERTIME", "MISSED_CLOCK_OUT", "MISSED_CLOCK_IN"]);
  return value.filter((item): item is TimeClockExceptionCode => typeof item === "string" && allowed.has(item as TimeClockExceptionCode));
}

function startOfBangkokWeekInput(value: string) {
  const start = bangkokDateStart(value);
  const day = start.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return dateInputValue(addBangkokDays(start, mondayOffset));
}

function localDateTime(dateValue: string, timeValue: string, start?: Date) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  let date = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0, 0));
  if (start && date <= start) {
    date = addBangkokDays(date, 1);
  }
  return date;
}

function bangkokDateStart(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0));
}

function addBangkokDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days, date.getUTCHours(), date.getUTCMinutes(), 0, 0));
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

function formatDateLabel(date: Date) {
  return new Date(date).toLocaleDateString("vi-VN", { timeZone: TIME_ZONE });
}

function diffMinutes(later: Date, earlier: Date) {
  return Math.max(0, Math.round((later.getTime() - earlier.getTime()) / 60000));
}

function toNullableNumber(value: bigint | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return typeof value === "bigint" ? Number(value) : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
