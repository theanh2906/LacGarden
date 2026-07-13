import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth";
import { getProductCostingAdminSnapshot } from "@/server/costing";
import type { ProductCostingAdminSnapshot } from "@/types/costing";
import { ProductCostingAdmin } from "./ProductCostingAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Giá vốn sản phẩm | Lac Garden POS",
  description: "Thiết lập công thức, BOM và biên lợi nhuận gộp cho Lac Garden POS"
};

const emptySnapshot: ProductCostingAdminSnapshot = {
  inventoryItems: [],
  targets: [],
  marginRule: {
    id: "",
    thresholdPercent: 35,
    updatedAt: new Date(0).toISOString()
  }
};

export default async function ProductCostingPage() {
  await requirePagePermission("inventory:manage", "/inventory/costing");

  try {
    const snapshot = await getProductCostingAdminSnapshot();
    return <ProductCostingAdmin initialSnapshot={snapshot} />;
  } catch (error) {
    console.info("[product-costing] Failed to load admin snapshot", error);
    return <ProductCostingAdmin initialSnapshot={emptySnapshot} />;
  }
}
