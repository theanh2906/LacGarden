"use client";

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Home,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  UserRoundCheck,
  Users
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { StaffUser } from "@/types/auth";
import type {
  EmployeeProfileDto,
  StaffOpsSnapshotDto,
  StaffScheduleDto,
  StaffScheduleRole,
  StaffScheduleStatus,
  TimesheetDto
} from "@/types/staff-ops";
import styles from "./StaffOpsAdmin.module.scss";

type StaffOpsAdminProps = {
  initialSnapshot: StaffOpsSnapshotDto;
  canManageStaff: boolean;
  staff: Pick<StaffUser, "displayName" | "role">;
};

type PendingOperation = "refresh" | "profile" | "schedule" | "clockIn" | "clockOut" | "timesheet" | "adjustment";

type ProfileFormState = {
  id: string;
  displayName: string;
  role: EmployeeProfileDto["role"];
  scheduleRole: StaffScheduleRole;
  phone: string;
  email: string;
  employeeCode: string;
  employmentStatus: EmployeeProfileDto["employmentStatus"];
  hourlyRateVnd: string;
  fixedSalaryVnd: string;
  note: string;
};

type ScheduleFormState = {
  id: string;
  employeeProfileId: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  role: StaffScheduleRole;
  status: StaffScheduleStatus;
  note: string;
};

const operationLabels: Record<PendingOperation, string> = {
  refresh: "Đang làm mới staff ops...",
  profile: "Đang lưu hồ sơ nhân sự...",
  schedule: "Đang lưu lịch ca...",
  clockIn: "Đang clock in...",
  clockOut: "Đang clock out...",
  timesheet: "Đang xử lý timesheet...",
  adjustment: "Đang ghi adjustment..."
};

const roles: Array<EmployeeProfileDto["role"]> = ["OWNER", "MANAGER", "CASHIER", "BARISTA", "VIEWER"];
const scheduleRoles: StaffScheduleRole[] = ["BAR", "CASHIER", "SERVICE", "MANAGER"];
const scheduleStatuses: StaffScheduleStatus[] = ["SCHEDULED", "CONFIRMED", "CANCELLED"];

export function StaffOpsAdmin({ initialSnapshot, canManageStaff, staff }: StaffOpsAdminProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialSnapshot.employees[0]?.id ?? "");
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() => toProfileForm(initialSnapshot.employees[0]));
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(() => defaultScheduleForm(initialSnapshot.employees[0]?.id));
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [adjustmentTimesheetId, setAdjustmentTimesheetId] = useState(initialSnapshot.timesheets[0]?.id ?? "");
  const [adjustmentMinutes, setAdjustmentMinutes] = useState("0");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [notice, setNotice] = useState("Staff operations ready.");
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);

  const selectedEmployee = snapshot.employees.find((employee) => employee.id === selectedEmployeeId) ?? snapshot.employees[0] ?? null;
  const currentClock = snapshot.currentClock;
  const isSubmitting = pendingOperation !== null;
  const loadingMessage = pendingOperation ? operationLabels[pendingOperation] : null;
  const selectedEmployeeSchedules = useMemo(
    () => snapshot.schedules.filter((schedule) => !selectedEmployee || schedule.employeeProfileId === selectedEmployee.id),
    [selectedEmployee, snapshot.schedules]
  );

  function selectEmployee(employee: EmployeeProfileDto) {
    setSelectedEmployeeId(employee.id);
    setProfileForm(toProfileForm(employee));
    setScheduleForm((current) => ({ ...current, employeeProfileId: employee.id }));
    setNotice(`Đang xem ${employee.displayName}`);
  }

  async function refreshSnapshot() {
    if (!canManageStaff) return;
    setPendingOperation("refresh");
    try {
      const response = await fetch("/api/staff-ops");
      const payload = (await response.json()) as { data?: StaffOpsSnapshotDto; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không tải được staff ops.");
      setSnapshot(payload.data);
      setNotice("Đã làm mới staff ops.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không tải được staff ops.");
    } finally {
      setPendingOperation(null);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingOperation("profile");
    try {
      const response = await fetch("/api/staff-ops/employees", {
        method: profileForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: profileForm.id || undefined,
          displayName: profileForm.displayName,
          role: profileForm.role,
          scheduleRole: profileForm.scheduleRole,
          phone: profileForm.phone,
          email: profileForm.email,
          employeeCode: profileForm.employeeCode,
          employmentStatus: profileForm.employmentStatus,
          hourlyRateVnd: profileForm.hourlyRateVnd ? parseInteger(profileForm.hourlyRateVnd) : null,
          salaryMetadata: profileForm.fixedSalaryVnd ? { fixedSalaryVnd: parseInteger(profileForm.fixedSalaryVnd) } : null,
          note: profileForm.note
        })
      });
      const payload = (await response.json()) as { data?: EmployeeProfileDto; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không lưu được hồ sơ.");
      setSnapshot((current) => ({ ...current, employees: upsertEmployee(current.employees, payload.data as EmployeeProfileDto) }));
      selectEmployee(payload.data);
      setNotice(`Đã lưu hồ sơ ${payload.data.displayName}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không lưu được hồ sơ.");
    } finally {
      setPendingOperation(null);
    }
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingOperation("schedule");
    try {
      const response = await fetch("/api/staff-ops/schedules", {
        method: scheduleForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: scheduleForm.id || undefined,
          employeeProfileId: scheduleForm.employeeProfileId,
          scheduleDate: scheduleForm.scheduleDate,
          startTime: scheduleForm.startTime,
          endTime: scheduleForm.endTime,
          role: scheduleForm.role,
          status: scheduleForm.status,
          note: scheduleForm.note
        })
      });
      const payload = (await response.json()) as { data?: StaffScheduleDto; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không lưu được lịch ca.");
      setSnapshot((current) => ({ ...current, schedules: upsertSchedule(current.schedules, payload.data as StaffScheduleDto) }));
      setScheduleForm(defaultScheduleForm(scheduleForm.employeeProfileId));
      setNotice(`Đã lưu ca ${payload.data.employeeName}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không lưu được lịch ca.");
    } finally {
      setPendingOperation(null);
    }
  }

  async function runClock(action: "in" | "out") {
    setPendingOperation(action === "in" ? "clockIn" : "clockOut");
    try {
      const response = await fetch("/api/staff-ops/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "out" ? { action, breakMinutes: parseInteger(breakMinutes) } : { action })
      });
      const payload = (await response.json()) as { data?: StaffOpsSnapshotDto["currentClock"]; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Clock action failed.");
      setSnapshot((current) => ({
        ...current,
        currentClock: payload.data ?? null,
        employees: payload.data?.employeeProfile ? upsertEmployee(current.employees, payload.data.employeeProfile) : current.employees
      }));
      setNotice(action === "in" ? "Đã clock in." : "Đã clock out.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Clock action failed.");
    } finally {
      setPendingOperation(null);
    }
  }

  async function runTimesheet(timesheet: TimesheetDto | null, action: "submit" | "approve" | "reject") {
    const employeeProfileId = timesheet?.employeeProfileId ?? selectedEmployee?.id;
    if (!employeeProfileId) return;
    setPendingOperation("timesheet");
    try {
      const response = await fetch("/api/staff-ops/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeProfileId,
          periodStart: timesheet?.periodStart ?? snapshot.period.startDate,
          periodEnd: timesheet?.periodEnd ?? snapshot.period.endDate,
          action
        })
      });
      const payload = (await response.json()) as { data?: TimesheetDto; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không xử lý được timesheet.");
      setSnapshot((current) => ({ ...current, timesheets: upsertTimesheet(current.timesheets, payload.data as TimesheetDto) }));
      setAdjustmentTimesheetId(payload.data.id);
      setNotice(`Timesheet ${payload.data.employeeName}: ${payload.data.status}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không xử lý được timesheet.");
    } finally {
      setPendingOperation(null);
    }
  }

  async function createAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustmentTimesheetId) return;
    setPendingOperation("adjustment");
    try {
      const response = await fetch("/api/staff-ops/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timesheetId: adjustmentTimesheetId,
          adjustmentType: "TIME_CORRECTION",
          minutesDelta: parseInteger(adjustmentMinutes),
          reason: adjustmentReason
        })
      });
      const payload = (await response.json()) as { data?: TimesheetDto; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không ghi được adjustment.");
      setSnapshot((current) => ({ ...current, timesheets: upsertTimesheet(current.timesheets, payload.data as TimesheetDto) }));
      setAdjustmentMinutes("0");
      setAdjustmentReason("");
      setNotice("Đã ghi adjustment.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không ghi được adjustment.");
    } finally {
      setPendingOperation(null);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Lac Garden POS</span>
          <h1>Staff operations</h1>
          <p>Employee profiles, shift scheduling, clock-in/out, exceptions, and timesheet approval.</p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.secondaryButton} href="/">
            <Home size={17} /> POS
          </a>
          {canManageStaff ? (
            <button className={styles.secondaryButton} type="button" onClick={() => refreshSnapshot().catch(() => undefined)} disabled={isSubmitting}>
              <ButtonContent loading={pendingOperation === "refresh"} icon={<RefreshCw size={17} />} label="Làm mới" loadingLabel="Đang tải..." />
            </button>
          ) : null}
        </div>
      </header>

      <section className={styles.notice} role="status">
        {loadingMessage ? <Loader2 className={styles.spinnerIcon} size={18} /> : <Clock size={18} />}
        <span>{loadingMessage ?? notice}</span>
      </section>

      <section className={styles.clockPanel}>
        <div>
          <span className={styles.kicker}>Clock</span>
          <h2>{currentClock?.employeeProfile.displayName ?? staff.displayName}</h2>
          <p>{currentClock?.todaySchedule ? `${formatTime(currentClock.todaySchedule.scheduledStartAt)} - ${formatTime(currentClock.todaySchedule.scheduledEndAt)} · ${currentClock.todaySchedule.role}` : "Chưa có ca hôm nay."}</p>
        </div>
        <div className={styles.clockState}>
          <strong>{currentClock?.openEntry ? `Đang làm từ ${formatTime(currentClock.openEntry.clockInAt)}` : "Chưa clock in"}</strong>
          {currentClock?.openEntry?.exceptions.length ? <small>{currentClock.openEntry.exceptions.join(", ")}</small> : <small>{roleText(staff.role)}</small>}
        </div>
        <label className={styles.breakInput}>
          <span>Break phút</span>
          <input type="number" min="0" max="720" value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} />
        </label>
        {currentClock?.openEntry ? (
          <button className={styles.primaryButton} type="button" onClick={() => runClock("out")} disabled={isSubmitting}>
            <ButtonContent loading={pendingOperation === "clockOut"} icon={<CheckCircle2 size={17} />} label="Clock out" loadingLabel="Đang clock out..." />
          </button>
        ) : (
          <button className={styles.primaryButton} type="button" onClick={() => runClock("in")} disabled={isSubmitting}>
            <ButtonContent loading={pendingOperation === "clockIn"} icon={<Clock size={17} />} label="Clock in" loadingLabel="Đang clock in..." />
          </button>
        )}
      </section>

      {!canManageStaff ? (
        <section className={styles.card}>
          <div className={styles.panelTitle}>
            <AlertTriangle size={18} />
            <strong>Manager area</strong>
          </div>
          <p className={styles.emptyState}>Chỉ manager/owner được quản lý hồ sơ, lịch ca và duyệt timesheet.</p>
        </section>
      ) : (
        <>
          <section className={styles.metrics}>
            <Metric label="Active staff" value={snapshot.summary.activeEmployees.toString()} />
            <Metric label="Scheduled shifts" value={snapshot.summary.scheduledShiftCount.toString()} />
            <Metric label="Open clocks" value={snapshot.summary.openClockEntryCount.toString()} tone={snapshot.summary.openClockEntryCount ? "warn" : undefined} />
            <Metric label="Pending approval" value={snapshot.summary.pendingApprovalCount.toString()} tone={snapshot.summary.pendingApprovalCount ? "danger" : undefined} />
            <Metric label="Exceptions" value={snapshot.summary.exceptionCount.toString()} tone={snapshot.summary.exceptionCount ? "warn" : undefined} />
          </section>

          <section className={styles.workbench}>
            <div className={styles.employeePane}>
              <div className={styles.toolbar}>
                <strong>Employees</strong>
                <button type="button" onClick={() => setProfileForm(toProfileForm(null))}>
                  <Plus size={15} /> New
                </button>
              </div>
              <div className={styles.employeeList}>
                {snapshot.employees.map((employee) => (
                  <button className={selectedEmployee?.id === employee.id ? styles.selectedRow : ""} key={employee.id} type="button" onClick={() => selectEmployee(employee)}>
                    <span>
                      <strong>{employee.displayName}</strong>
                      <small>{employee.employeeCode ?? "No code"} · {employee.scheduleRole}</small>
                    </span>
                    <StatusBadge status={employee.employmentStatus} />
                  </button>
                ))}
              </div>

              <form className={styles.card} onSubmit={saveProfile}>
                <div className={styles.panelTitle}>
                  <Users size={18} />
                  <strong>Employee profile</strong>
                </div>
                <div className={styles.formGrid}>
                  <Field label="Name">
                    <input required value={profileForm.displayName} onChange={(event) => setProfileForm({ ...profileForm, displayName: event.target.value })} />
                  </Field>
                  <Field label="Code">
                    <input value={profileForm.employeeCode} onChange={(event) => setProfileForm({ ...profileForm, employeeCode: event.target.value })} />
                  </Field>
                  <Field label="Auth role">
                    <select value={profileForm.role} onChange={(event) => setProfileForm({ ...profileForm, role: event.target.value as ProfileFormState["role"] })}>
                      {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </Field>
                  <Field label="Schedule role">
                    <select value={profileForm.scheduleRole} onChange={(event) => setProfileForm({ ...profileForm, scheduleRole: event.target.value as StaffScheduleRole })}>
                      {scheduleRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </Field>
                  <Field label="Phone">
                    <input value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={profileForm.email} onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })} />
                  </Field>
                  <Field label="Status">
                    <select value={profileForm.employmentStatus} onChange={(event) => setProfileForm({ ...profileForm, employmentStatus: event.target.value as ProfileFormState["employmentStatus"] })}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="ON_LEAVE">ON_LEAVE</option>
                      <option value="TERMINATED">TERMINATED</option>
                    </select>
                  </Field>
                  <Field label="Hourly VND">
                    <input type="number" min="0" step="1" value={profileForm.hourlyRateVnd} onChange={(event) => setProfileForm({ ...profileForm, hourlyRateVnd: event.target.value })} />
                  </Field>
                  <Field label="Fixed salary">
                    <input type="number" min="0" step="1" value={profileForm.fixedSalaryVnd} onChange={(event) => setProfileForm({ ...profileForm, fixedSalaryVnd: event.target.value })} />
                  </Field>
                </div>
                <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
                  <ButtonContent loading={pendingOperation === "profile"} icon={<Save size={17} />} label="Lưu hồ sơ" loadingLabel="Đang lưu..." />
                </button>
              </form>
            </div>

            <div className={styles.detailPane}>
              <form className={styles.card} onSubmit={saveSchedule}>
                <div className={styles.panelTitle}>
                  <CalendarClock size={18} />
                  <strong>Shift scheduling</strong>
                </div>
                <div className={styles.formGrid}>
                  <Field label="Employee">
                    <select value={scheduleForm.employeeProfileId} onChange={(event) => setScheduleForm({ ...scheduleForm, employeeProfileId: event.target.value })}>
                      {snapshot.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.displayName}</option>)}
                    </select>
                  </Field>
                  <Field label="Date">
                    <input required type="date" value={scheduleForm.scheduleDate} onChange={(event) => setScheduleForm({ ...scheduleForm, scheduleDate: event.target.value })} />
                  </Field>
                  <Field label="Start">
                    <input required type="time" value={scheduleForm.startTime} onChange={(event) => setScheduleForm({ ...scheduleForm, startTime: event.target.value })} />
                  </Field>
                  <Field label="End">
                    <input required type="time" value={scheduleForm.endTime} onChange={(event) => setScheduleForm({ ...scheduleForm, endTime: event.target.value })} />
                  </Field>
                  <Field label="Role">
                    <select value={scheduleForm.role} onChange={(event) => setScheduleForm({ ...scheduleForm, role: event.target.value as StaffScheduleRole })}>
                      {scheduleRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select value={scheduleForm.status} onChange={(event) => setScheduleForm({ ...scheduleForm, status: event.target.value as StaffScheduleStatus })}>
                      {scheduleStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </Field>
                </div>
                <button className={styles.primaryButton} type="submit" disabled={isSubmitting || !scheduleForm.employeeProfileId}>
                  <ButtonContent loading={pendingOperation === "schedule"} icon={<Save size={17} />} label="Lưu ca" loadingLabel="Đang lưu..." />
                </button>
              </form>

              <section className={styles.card}>
                <div className={styles.panelTitle}>
                  <CalendarClock size={18} />
                  <strong>Schedule board</strong>
                </div>
                <div className={styles.scheduleGrid}>
                  {selectedEmployeeSchedules.map((schedule) => (
                    <article key={schedule.id}>
                      <strong>{schedule.employeeName}</strong>
                      <span>{formatDate(schedule.scheduleDate)} · {formatTime(schedule.scheduledStartAt)} - {formatTime(schedule.scheduledEndAt)}</span>
                      <small>{schedule.role} · {schedule.status}</small>
                      <button type="button" onClick={() => setScheduleForm(toScheduleForm(schedule))}>Edit</button>
                    </article>
                  ))}
                  {!selectedEmployeeSchedules.length ? <p className={styles.emptyState}>Chưa có ca trong kỳ.</p> : null}
                </div>
              </section>
            </div>
          </section>

          <section className={styles.twoColumn}>
            <ReportTable title="Clock entries & exceptions" columns={["Staff", "Clock", "Worked", "Exceptions", "Status"]}>
              {snapshot.clockEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.employeeName}</td>
                  <td>
                    <strong>{formatDateTime(entry.clockInAt)}</strong>
                    <small>{entry.clockOutAt ? formatDateTime(entry.clockOutAt) : "Open"}</small>
                  </td>
                  <td>{formatDuration(entry.workedMinutes)}</td>
                  <td>{entry.exceptions.length ? entry.exceptions.join(", ") : "-"}</td>
                  <td>{entry.status}</td>
                </tr>
              ))}
            </ReportTable>

            <section className={styles.card}>
              <div className={styles.panelTitle}>
                <UserRoundCheck size={18} />
                <strong>Timesheet approval</strong>
              </div>
              <div className={styles.timesheetList}>
                {snapshot.timesheets.map((timesheet) => (
                  <article key={timesheet.id}>
                    <div>
                      <strong>{timesheet.employeeName}</strong>
                      <small>{timesheet.periodStart} - {timesheet.periodEnd} · {timesheet.status}</small>
                    </div>
                    <span>{formatDuration(timesheet.totalWorkedMinutes)} · OT {formatDuration(timesheet.overtimeMinutes)}</span>
                    <div className={styles.actionRow}>
                      <button type="button" onClick={() => runTimesheet(timesheet, "submit")} disabled={isSubmitting}>Submit</button>
                      <button type="button" onClick={() => runTimesheet(timesheet, "approve")} disabled={isSubmitting}>Approve</button>
                      <button type="button" onClick={() => runTimesheet(timesheet, "reject")} disabled={isSubmitting}>Reject</button>
                    </div>
                  </article>
                ))}
                {!snapshot.timesheets.length ? (
                  <div className={styles.emptyBlock}>
                    <p>Chưa có timesheet trong kỳ.</p>
                    <button type="button" onClick={() => runTimesheet(null, "submit")} disabled={isSubmitting || !selectedEmployee}>
                      Generate selected employee
                    </button>
                  </div>
                ) : null}
              </div>
              <form className={styles.adjustmentForm} onSubmit={createAdjustment}>
                <select value={adjustmentTimesheetId} onChange={(event) => setAdjustmentTimesheetId(event.target.value)}>
                  <option value="">Chọn timesheet</option>
                  {snapshot.timesheets.map((timesheet) => <option key={timesheet.id} value={timesheet.id}>{timesheet.employeeName}</option>)}
                </select>
                <input type="number" value={adjustmentMinutes} onChange={(event) => setAdjustmentMinutes(event.target.value)} />
                <input required value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="Reason" />
                <button type="submit" disabled={isSubmitting || !adjustmentTimesheetId}>Adjust</button>
              </form>
            </section>
          </section>
        </>
      )}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ButtonContent({ loading, icon, label, loadingLabel }: { loading: boolean; icon?: ReactNode; label: string; loadingLabel: string }) {
  return (
    <>
      {loading ? <Loader2 className={styles.spinnerIcon} size={17} /> : icon}
      {loading ? loadingLabel : label}
    </>
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
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

function StatusBadge({ status }: { status: EmployeeProfileDto["employmentStatus"] }) {
  return <small className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>{status}</small>;
}

function toProfileForm(employee?: EmployeeProfileDto | null): ProfileFormState {
  return {
    id: employee?.id ?? "",
    displayName: employee?.displayName ?? "",
    role: employee?.role ?? "CASHIER",
    scheduleRole: employee?.scheduleRole ?? "SERVICE",
    phone: employee?.phone ?? "",
    email: employee?.email ?? "",
    employeeCode: employee?.employeeCode ?? "",
    employmentStatus: employee?.employmentStatus ?? "ACTIVE",
    hourlyRateVnd: employee?.hourlyRateVnd?.toString() ?? "",
    fixedSalaryVnd: getSalaryMetadataNumber(employee?.salaryMetadata, "fixedSalaryVnd"),
    note: employee?.note ?? ""
  };
}

function defaultScheduleForm(employeeProfileId = ""): ScheduleFormState {
  return {
    id: "",
    employeeProfileId,
    scheduleDate: new Date().toISOString().slice(0, 10),
    startTime: "08:00",
    endTime: "16:00",
    role: "SERVICE",
    status: "SCHEDULED",
    note: ""
  };
}

function toScheduleForm(schedule: StaffScheduleDto): ScheduleFormState {
  return {
    id: schedule.id,
    employeeProfileId: schedule.employeeProfileId,
    scheduleDate: schedule.scheduleDate,
    startTime: timeInputValue(schedule.scheduledStartAt),
    endTime: timeInputValue(schedule.scheduledEndAt),
    role: schedule.role,
    status: schedule.status,
    note: schedule.note ?? ""
  };
}

function upsertEmployee(items: EmployeeProfileDto[], item: EmployeeProfileDto) {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [item, ...items].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function upsertSchedule(items: StaffScheduleDto[], item: StaffScheduleDto) {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [item, ...items].sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt));
}

function upsertTimesheet(items: TimesheetDto[], item: TimesheetDto) {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [item, ...items];
}

function parseInteger(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function getSalaryMetadataNumber(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value;
  return "";
}

function roleText(role: StaffUser["role"]) {
  const map: Record<StaffUser["role"], string> = {
    OWNER: "Owner",
    MANAGER: "Manager",
    CASHIER: "Cashier",
    BARISTA: "Barista",
    VIEWER: "Viewer"
  };
  return map[role];
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("vi-VN");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function timeInputValue(value: string) {
  return new Date(value).toISOString().slice(11, 16);
}

function formatDuration(minutes: number) {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  const prefix = minutes < 0 ? "-" : "";
  return `${prefix}${hours}h ${String(mins).padStart(2, "0")}m`;
}
