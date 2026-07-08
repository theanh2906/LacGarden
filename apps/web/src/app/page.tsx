import { PosApp, type PosView } from "@/components/pos/PosApp";
import { getStaffClientPermissions, requirePageSession } from "@/server/auth";
import { getPosSnapshot } from "@/server/pos";
import type { PosSnapshot } from "@/types/pos";

export const dynamic = "force-dynamic";

const posViews: PosView[] = ["POS", "Orders", "Queue", "Reports", "Settings"];

const emptySnapshot: PosSnapshot = {
  menuCategories: [{ id: "all", name: "Tất cả" }],
  menuItems: [],
  recentOrders: [],
  barQueue: [],
  salesReport: {
    revenueToday: 0,
    orderCount: 0,
    averageOrderValue: 0,
    cashPercent: 0,
    transferPercent: 0,
    topProducts: []
  }
};

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const session = await requirePageSession(view ? `/?view=${encodeURIComponent(view)}` : "/");
  const permissions = getStaffClientPermissions(session.staff.role);
  const requestedView = posViews.includes(view as PosView) ? (view as PosView) : "POS";
  const initialView = isAllowedInitialView(requestedView, permissions) ? requestedView : "POS";

  try {
    const snapshot = await getPosSnapshot({ includeSalesReport: permissions.canManageReports });
    return (
      <PosApp
        initialSnapshot={snapshot}
        initialView={initialView}
        staff={{ displayName: session.staff.displayName, role: session.staff.role }}
        permissions={permissions}
      />
    );
  } catch (error) {
    console.info("[pos] Failed to load POS snapshot", error);
    return (
      <PosApp
        initialSnapshot={emptySnapshot}
        initialView={initialView}
        staff={{ displayName: session.staff.displayName, role: session.staff.role }}
        permissions={permissions}
      />
    );
  }
}

function isAllowedInitialView(
  view: PosView,
  permissions: {
    canManageReports: boolean;
    canManageSettings: boolean;
  }
) {
  if (view === "Reports") return permissions.canManageReports;
  if (view === "Settings") return permissions.canManageSettings;
  return true;
}
