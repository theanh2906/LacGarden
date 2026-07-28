import type { Metadata } from "next";
import { getStaffClientPermissions, requirePageSession } from "@/server/auth";
import { getProductCostingAdminSnapshot } from "@/server/costing";
import type { ProductCostingAdminSnapshot } from "@/types/costing";
import { RecipeBook } from "./RecipeBook";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Công thức pha chế | Lac Garden POS",
  description: "Xem và quản lý công thức pha chế cho menu Lac Garden"
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

export default async function RecipesPage() {
  const session = await requirePageSession("/recipes");
  const permissions = getStaffClientPermissions(session.staff.role);

  try {
    const snapshot = await getProductCostingAdminSnapshot();
    return <RecipeBook initialSnapshot={snapshot} canEditRecipes={permissions.canManageInventory} />;
  } catch (error) {
    console.info("[recipes] Failed to load recipe snapshot", error);
    return <RecipeBook initialSnapshot={emptySnapshot} canEditRecipes={permissions.canManageInventory} />;
  }
}
