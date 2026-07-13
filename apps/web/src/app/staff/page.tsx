import type { Metadata } from "next";
import { getCurrentStaffClockState, getStaffOpsSnapshot } from "@/server/staff-ops";
import { hasStaffPermission, requirePageSession } from "@/server/auth";
import type { StaffOpsSnapshotDto } from "@/types/staff-ops";
import { StaffOpsAdmin } from "./StaffOpsAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vận hành nhân sự | Lac Garden POS",
  description: "Hồ sơ nhân viên, lịch ca, chấm công và duyệt bảng chấm công"
};

type StaffPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const session = await requirePageSession("/staff");
  const params = await searchParams;
  const query = normalizeQuery(params);
  const canManageStaff = hasStaffPermission(session.staff.role, "payroll:manage");

  let snapshot: StaffOpsSnapshotDto;
  try {
    snapshot = canManageStaff
      ? await getStaffOpsSnapshot(query, { staffId: session.staff.id })
      : emptySnapshot(await getCurrentStaffClockState(session.staff.id));
  } catch (error) {
    console.info("[staff-ops] Failed to load staff page", error);
    snapshot = emptySnapshot(await getCurrentStaffClockState(session.staff.id).catch(() => null));
  }

  return (
    <StaffOpsAdmin
      initialSnapshot={snapshot}
      canManageStaff={canManageStaff}
      staff={{ displayName: session.staff.displayName, role: session.staff.role }}
    />
  );
}

function normalizeQuery(params: Record<string, string | string[] | undefined>) {
  const entries = Object.entries(params).flatMap(([key, value]) => {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw ? [[key, raw]] : [];
  });
  return Object.fromEntries(entries);
}

function emptySnapshot(currentClock: StaffOpsSnapshotDto["currentClock"]): StaffOpsSnapshotDto {
  const today = new Date().toISOString().slice(0, 10);
  return {
    period: {
      startDate: today,
      endDate: today,
      label: today
    },
    employees: currentClock ? [currentClock.employeeProfile] : [],
    schedules: currentClock?.todaySchedule ? [currentClock.todaySchedule] : [],
    clockEntries: currentClock?.openEntry ? [currentClock.openEntry] : [],
    timesheets: [],
    currentClock,
    summary: {
      activeEmployees: currentClock ? 1 : 0,
      scheduledShiftCount: currentClock?.todaySchedule ? 1 : 0,
      openClockEntryCount: currentClock?.openEntry ? 1 : 0,
      pendingApprovalCount: 0,
      exceptionCount: currentClock?.openEntry?.exceptions.length ?? 0
    }
  };
}
