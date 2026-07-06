import { PosApp, type PosView } from "@/components/pos/PosApp";
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
  const initialView = posViews.includes(view as PosView) ? (view as PosView) : "POS";

  try {
    const snapshot = await getPosSnapshot();
    return <PosApp initialSnapshot={snapshot} initialView={initialView} />;
  } catch (error) {
    console.info("[pos] Failed to load POS snapshot", error);
    return <PosApp initialSnapshot={emptySnapshot} initialView={initialView} />;
  }
}
