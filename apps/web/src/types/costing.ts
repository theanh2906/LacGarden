export type ProductRecipeTargetType = "MENU_ITEM" | "MENU_VARIANT";

export type ProductRecipeIngredientDto = {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemUnit: string;
  quantity: number;
  unit: string;
  wastePercent: number;
  latestUnitCostVnd: number | null;
  lineCostVnd: number;
  sortOrder: number;
};

export type ProductRecipeDto = {
  id: string;
  targetType: ProductRecipeTargetType;
  targetId: string;
  menuItemId: string;
  variantId: string | null;
  packagingCostVnd: number;
  note: string | null;
  ingredients: ProductRecipeIngredientDto[];
  updatedAt: string;
};

export type ProductCostDto = {
  recipeId: string | null;
  recipeSource: "target" | "item-fallback" | "none";
  ingredientCostVnd: number;
  packagingCostVnd: number;
  totalCostVnd: number;
  grossMarginVnd: number;
  grossMarginPercent: number;
  lowMarginThresholdPercent: number;
  isLowMargin: boolean;
  missingCostIngredientCount: number;
};

export type ProductCostTargetDto = {
  targetType: ProductRecipeTargetType;
  targetId: string;
  menuItemId: string;
  variantId: string | null;
  label: string;
  salePriceVnd: number;
  cost: ProductCostDto;
  recipe: ProductRecipeDto | null;
};

export type ProductCostingInventoryItemDto = {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  latestUnitCostVnd: number | null;
  isActive: boolean;
};

export type ProductMarginRuleDto = {
  id: string;
  thresholdPercent: number;
  updatedAt: string;
};

export type ProductCostingAdminSnapshot = {
  inventoryItems: ProductCostingInventoryItemDto[];
  targets: ProductCostTargetDto[];
  marginRule: ProductMarginRuleDto;
};
