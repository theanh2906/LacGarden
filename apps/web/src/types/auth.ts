import type { UserRole } from "@prisma/client";

export type StaffUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
};

export type StaffSession = {
  staff: StaffUser;
  expiresAt: string;
};

export type StaffPermission =
  | "pos:access"
  | "orders:manage"
  | "payments:collect"
  | "bar:manage"
  | "reports:view"
  | "inventory:manage"
  | "settings:manage"
  | "payroll:manage"
  | "dorm:manage";

export type StaffClientPermissions = {
  canManageReports: boolean;
  canManageInventory: boolean;
  canManageSettings: boolean;
  canManagePayroll: boolean;
  canManageDorm: boolean;
};
