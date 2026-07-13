import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth";
import { getInventoryAdminSnapshot } from "@/server/inventory";
import type { InventoryAdminSnapshot } from "@/types/inventory";
import { InventoryAdmin } from "./InventoryAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quản lý kho | Lac Garden POS",
  description: "Quản lý kho trên máy tính cho Lac Garden POS"
};

const emptySnapshot: InventoryAdminSnapshot = {
  items: [],
  recentMovements: [],
  summary: {
    totalItems: 0,
    activeItems: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    inactiveItems: 0,
    stockValueVnd: 0
  }
};

export default async function InventoryPage() {
  await requirePagePermission("inventory:manage", "/inventory");

  try {
    const snapshot = await getInventoryAdminSnapshot();
    return <InventoryAdmin initialSnapshot={snapshot} />;
  } catch (error) {
    console.info("[inventory] Failed to load admin snapshot", error);
    return <InventoryAdmin initialSnapshot={emptySnapshot} />;
  }
}
