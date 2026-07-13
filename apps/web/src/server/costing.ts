import { Prisma } from "@prisma/client";
import { getDb } from "@/server/db";
import type { UpsertProductRecipeInput, UpdateProductMarginRuleInput } from "@/server/costing-validation";
import type {
  ProductCostDto,
  ProductCostingAdminSnapshot,
  ProductCostingInventoryItemDto,
  ProductCostTargetDto,
  ProductMarginRuleDto,
  ProductRecipeDto,
  ProductRecipeTargetType
} from "@/types/costing";

const DEFAULT_MARGIN_RULE_NAME = "default";
const DEFAULT_LOW_MARGIN_THRESHOLD_PERCENT = 35;

type ProductTarget = {
  targetType: ProductRecipeTargetType;
  targetId: string;
  menuItemId: string;
  variantId: string | null;
  label: string;
  salePriceVnd: number;
};

type RecipeWithIngredients = Prisma.ProductRecipeGetPayload<{
  include: {
    ingredients: {
      include: {
        inventoryItem: true;
      };
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }];
    };
  };
}>;

type CostCalculation = ProductCostDto & {
  recipe: RecipeWithIngredients | null;
};

type OrderItemForCosting = {
  id: string;
  menuItemId: string | null;
  variantId: string | null;
  unitPriceSnapshot: bigint | number;
};

export type MenuVariantCostSummary = Pick<
  ProductCostDto,
  "totalCostVnd" | "grossMarginPercent" | "isLowMargin" | "missingCostIngredientCount" | "recipeSource"
>;

export class ProductCostingServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductCostingServiceError";
  }
}

export function getProductCostingErrorMessage(error: unknown) {
  if (error instanceof ProductCostingServiceError) return error.message;
  return "Thao tác giá vốn sản phẩm thất bại. Kiểm tra nhật ký quản trị để biết chi tiết.";
}

export async function getProductCostingAdminSnapshot(): Promise<ProductCostingAdminSnapshot> {
  const db = getDb();
  const [menuItems, inventoryItems, recipes, marginRule] = await Promise.all([
    db.menuItem.findMany({
      where: {
        isActive: true,
        category: { isActive: true }
      },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        }
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
    }),
    db.inventoryItem.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    }),
    db.productRecipe.findMany({
      include: recipeInclude,
      orderBy: { updatedAt: "desc" }
    }),
    getOrCreateDefaultMarginRule()
  ]);

  const latestUnitCostByItemId = await getLatestUnitCostByInventoryItemIds(inventoryItems.map((item) => item.id));
  const recipeByTargetKey = new Map(recipes.map((recipe) => [recipe.targetKey, recipe]));
  const targets = menuItems.flatMap<ProductTarget>((item) => [
    {
      targetType: "MENU_ITEM",
      targetId: item.id,
      menuItemId: item.id,
      variantId: null,
      label: `${item.name} · Base`,
      salePriceVnd: toNumber(item.basePrice)
    },
    ...item.variants.map((variant) => ({
      targetType: "MENU_VARIANT" as const,
      targetId: variant.id,
      menuItemId: item.id,
      variantId: variant.id,
      label: `${item.name} · ${variant.name}`,
      salePriceVnd: toNumber(variant.price)
    }))
  ]);

  return {
    inventoryItems: inventoryItems.map((item): ProductCostingInventoryItemDto => ({
      id: item.id,
      name: item.name,
      code: item.code,
      unit: item.unit,
      latestUnitCostVnd: latestUnitCostByItemId.get(item.id) ?? null,
      isActive: item.isActive
    })),
    targets: targets.map((target) => mapCostTarget(target, recipeByTargetKey, latestUnitCostByItemId, marginRule.thresholdPercent.toNumber())),
    marginRule: mapMarginRule(marginRule)
  };
}

export async function upsertProductRecipe(input: UpsertProductRecipeInput): Promise<ProductCostingAdminSnapshot> {
  const db = getDb();
  await db.$transaction(async (tx) => {
    const target = await resolveTargetInTransaction(tx, input.targetType, input.targetId);
    const targetKey = getTargetKey(input.targetType, input.targetId);

    const recipe = await tx.productRecipe.upsert({
      where: { targetKey },
      create: {
        targetType: input.targetType,
        targetKey,
        menuItemId: target.menuItemId,
        variantId: target.variantId,
        packagingCostVnd: BigInt(input.packagingCostVnd),
        note: input.note
      },
      update: {
        menuItemId: target.menuItemId,
        variantId: target.variantId,
        packagingCostVnd: BigInt(input.packagingCostVnd),
        note: input.note
      }
    });

    await tx.productRecipeIngredient.deleteMany({
      where: { recipeId: recipe.id }
    });

    if (input.ingredients.length) {
      const inventoryItemIds = [...new Set(input.ingredients.map((ingredient) => ingredient.inventoryItemId))];
      const existingCount = await tx.inventoryItem.count({
        where: {
          id: { in: inventoryItemIds },
          isActive: true
        }
      });
      if (existingCount !== inventoryItemIds.length) {
        throw new ProductCostingServiceError("Công thức chứa nguyên liệu không còn hoạt động hoặc không tồn tại.");
      }

      await tx.productRecipeIngredient.createMany({
        data: input.ingredients.map((ingredient, index) => ({
          recipeId: recipe.id,
          inventoryItemId: ingredient.inventoryItemId,
          quantity: toDecimal(ingredient.quantity),
          unit: ingredient.unit,
          wastePercent: toDecimal(ingredient.wastePercent),
          sortOrder: index
        }))
      });
    }

    const marginRule = await getOrCreateDefaultMarginRuleInTransaction(tx);
    const savedRecipe = await tx.productRecipe.findUniqueOrThrow({
      where: { id: recipe.id },
      include: recipeInclude
    });
    const latestCosts = await getLatestUnitCostByInventoryItemIdsInTransaction(
      tx,
      savedRecipe.ingredients.map((ingredient) => ingredient.inventoryItemId)
    );
    const calculation = calculateCostFromRecipe({
      recipe: savedRecipe,
      recipeSource: "target",
      salePriceVnd: target.salePriceVnd,
      latestUnitCostByItemId: latestCosts,
      lowMarginThresholdPercent: marginRule.thresholdPercent.toNumber()
    });

    await createProductCostSnapshotInTransaction(tx, {
      source: "RECIPE_UPDATE",
      target,
      recipeId: savedRecipe.id,
      calculation
    });
  });

  return getProductCostingAdminSnapshot();
}

export async function updateProductMarginRule(input: UpdateProductMarginRuleInput): Promise<ProductCostingAdminSnapshot> {
  const db = getDb();
  await db.productMarginRule.upsert({
    where: { name: DEFAULT_MARGIN_RULE_NAME },
    create: {
      name: DEFAULT_MARGIN_RULE_NAME,
      thresholdPercent: toDecimal(input.thresholdPercent),
      isActive: true
    },
    update: {
      thresholdPercent: toDecimal(input.thresholdPercent),
      isActive: true
    }
  });

  return getProductCostingAdminSnapshot();
}

export async function getMenuVariantCostSummaries(
  variants: Array<{ id: string; itemId: string; price: bigint | number }>
): Promise<Map<string, MenuVariantCostSummary>> {
  const db = getDb();
  const summaries = new Map<string, MenuVariantCostSummary>();
  if (!variants.length) return summaries;

  const [recipes, marginRule] = await Promise.all([
    db.productRecipe.findMany({
      where: {
        OR: [
          { targetKey: { in: variants.map((variant) => getTargetKey("MENU_ITEM", variant.itemId)) } },
          { targetKey: { in: variants.map((variant) => getTargetKey("MENU_VARIANT", variant.id)) } }
        ]
      },
      include: recipeInclude
    }),
    getOrCreateDefaultMarginRule()
  ]);
  const recipeByTargetKey = new Map(recipes.map((recipe) => [recipe.targetKey, recipe]));
  const inventoryItemIds = [...new Set(recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.inventoryItemId)))];
  const latestCosts = await getLatestUnitCostByInventoryItemIds(inventoryItemIds);
  const threshold = marginRule.thresholdPercent.toNumber();

  for (const variant of variants) {
    const target: ProductTarget = {
      targetType: "MENU_VARIANT",
      targetId: variant.id,
      menuItemId: variant.itemId,
      variantId: variant.id,
      label: "",
      salePriceVnd: toNumber(variant.price)
    };
    const recipe = resolveRecipeForTarget(target, recipeByTargetKey);
    const calculation = recipe
      ? calculateCostFromRecipe({
          recipe,
          recipeSource: recipe.targetKey === getTargetKey("MENU_VARIANT", variant.id) ? "target" : "item-fallback",
          salePriceVnd: target.salePriceVnd,
          latestUnitCostByItemId: latestCosts,
          lowMarginThresholdPercent: threshold
        })
      : emptyCost(target.salePriceVnd, threshold);

    summaries.set(variant.id, {
      totalCostVnd: calculation.totalCostVnd,
      grossMarginPercent: calculation.grossMarginPercent,
      isLowMargin: calculation.isLowMargin,
      missingCostIngredientCount: calculation.missingCostIngredientCount,
      recipeSource: calculation.recipeSource
    });
  }

  return summaries;
}

export async function createOrderItemCostSnapshotsInTransaction(tx: Prisma.TransactionClient, orderItems: OrderItemForCosting[]) {
  const costableItems = orderItems.filter((item) => item.menuItemId);
  if (!costableItems.length) return;

  const [recipes, marginRule] = await Promise.all([
    tx.productRecipe.findMany({
      where: {
        OR: [
          { targetKey: { in: costableItems.map((item) => getTargetKey("MENU_ITEM", item.menuItemId as string)) } },
          { targetKey: { in: costableItems.filter((item) => item.variantId).map((item) => getTargetKey("MENU_VARIANT", item.variantId as string)) } }
        ]
      },
      include: recipeInclude
    }),
    getOrCreateDefaultMarginRuleInTransaction(tx)
  ]);

  const recipeByTargetKey = new Map(recipes.map((recipe) => [recipe.targetKey, recipe]));
  const inventoryItemIds = [...new Set(recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.inventoryItemId)))];
  const latestCosts = await getLatestUnitCostByInventoryItemIdsInTransaction(tx, inventoryItemIds);

  for (const orderItem of costableItems) {
    const target: ProductTarget = {
      targetType: orderItem.variantId ? "MENU_VARIANT" : "MENU_ITEM",
      targetId: orderItem.variantId ?? (orderItem.menuItemId as string),
      menuItemId: orderItem.menuItemId as string,
      variantId: orderItem.variantId,
      label: "",
      salePriceVnd: toNumber(orderItem.unitPriceSnapshot)
    };
    const recipe = resolveRecipeForTarget(target, recipeByTargetKey);
    const calculation = recipe
      ? calculateCostFromRecipe({
          recipe,
          recipeSource: recipe.targetKey === getTargetKey(target.targetType, target.targetId) ? "target" : "item-fallback",
          salePriceVnd: target.salePriceVnd,
          latestUnitCostByItemId: latestCosts,
          lowMarginThresholdPercent: marginRule.thresholdPercent.toNumber()
        })
      : emptyCost(target.salePriceVnd, marginRule.thresholdPercent.toNumber());

    await createProductCostSnapshotInTransaction(tx, {
      source: "SALE",
      target,
      recipeId: recipe?.id ?? null,
      orderItemId: orderItem.id,
      calculation
    });
  }
}

const recipeInclude = {
  ingredients: {
    include: {
      inventoryItem: true
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  }
} satisfies Prisma.ProductRecipeInclude;

async function resolveTargetInTransaction(
  tx: Prisma.TransactionClient,
  targetType: ProductRecipeTargetType,
  targetId: string
): Promise<ProductTarget> {
  if (targetType === "MENU_ITEM") {
    const item = await tx.menuItem.findUniqueOrThrow({
      where: { id: targetId }
    });
    return {
      targetType,
      targetId,
      menuItemId: item.id,
      variantId: null,
      label: item.name,
      salePriceVnd: toNumber(item.basePrice)
    };
  }

  const variant = await tx.menuItemVariant.findUniqueOrThrow({
    where: { id: targetId },
    include: {
      item: true
    }
  });
  return {
    targetType,
    targetId,
    menuItemId: variant.itemId,
    variantId: variant.id,
    label: `${variant.item.name} · ${variant.name}`,
    salePriceVnd: toNumber(variant.price)
  };
}

function mapCostTarget(
  target: ProductTarget,
  recipeByTargetKey: Map<string, RecipeWithIngredients>,
  latestUnitCostByItemId: Map<string, number>,
  lowMarginThresholdPercent: number
): ProductCostTargetDto {
  const ownRecipe = recipeByTargetKey.get(getTargetKey(target.targetType, target.targetId)) ?? null;
  const resolvedRecipe = resolveRecipeForTarget(target, recipeByTargetKey);
  const recipeSource = resolvedRecipe ? (resolvedRecipe.id === ownRecipe?.id ? "target" : "item-fallback") : "none";
  const cost = resolvedRecipe
    ? calculateCostFromRecipe({
        recipe: resolvedRecipe,
        recipeSource,
        salePriceVnd: target.salePriceVnd,
        latestUnitCostByItemId,
        lowMarginThresholdPercent
      })
    : emptyCost(target.salePriceVnd, lowMarginThresholdPercent);

  return {
    ...target,
    cost,
    recipe: ownRecipe ? mapRecipe(ownRecipe, latestUnitCostByItemId) : null
  };
}

function resolveRecipeForTarget(target: ProductTarget, recipeByTargetKey: Map<string, RecipeWithIngredients>) {
  const ownRecipe = recipeByTargetKey.get(getTargetKey(target.targetType, target.targetId));
  if (ownRecipe) return ownRecipe;
  if (target.targetType === "MENU_VARIANT") {
    return recipeByTargetKey.get(getTargetKey("MENU_ITEM", target.menuItemId)) ?? null;
  }
  return null;
}

function calculateCostFromRecipe({
  recipe,
  recipeSource,
  salePriceVnd,
  latestUnitCostByItemId,
  lowMarginThresholdPercent
}: {
  recipe: RecipeWithIngredients;
  recipeSource: ProductCostDto["recipeSource"];
  salePriceVnd: number;
  latestUnitCostByItemId: Map<string, number>;
  lowMarginThresholdPercent: number;
}): CostCalculation {
  const ingredientCostVnd = recipe.ingredients.reduce((total, ingredient) => {
    const unitCost = latestUnitCostByItemId.get(ingredient.inventoryItemId);
    if (unitCost === undefined) return total;
    return total + calculateIngredientLineCost({
      quantity: ingredient.quantity,
      wastePercent: ingredient.wastePercent,
      unitCostVnd: unitCost
    });
  }, 0);
  const packagingCostVnd = toNumber(recipe.packagingCostVnd);
  const totalCostVnd = ingredientCostVnd + packagingCostVnd;
  const grossMarginVnd = salePriceVnd - totalCostVnd;
  const grossMarginPercent = salePriceVnd > 0 ? roundPercent((grossMarginVnd / salePriceVnd) * 100) : 0;

  return {
    recipe,
    recipeId: recipe.id,
    recipeSource,
    ingredientCostVnd,
    packagingCostVnd,
    totalCostVnd,
    grossMarginVnd,
    grossMarginPercent,
    lowMarginThresholdPercent,
    isLowMargin: grossMarginPercent < lowMarginThresholdPercent,
    missingCostIngredientCount: recipe.ingredients.filter((ingredient) => latestUnitCostByItemId.get(ingredient.inventoryItemId) === undefined).length
  };
}

function emptyCost(salePriceVnd: number, lowMarginThresholdPercent: number): CostCalculation {
  return {
    recipe: null,
    recipeId: null,
    recipeSource: "none",
    ingredientCostVnd: 0,
    packagingCostVnd: 0,
    totalCostVnd: 0,
    grossMarginVnd: salePriceVnd,
    grossMarginPercent: salePriceVnd > 0 ? 100 : 0,
    lowMarginThresholdPercent,
    isLowMargin: false,
    missingCostIngredientCount: 0
  };
}

async function createProductCostSnapshotInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    source: "RECIPE_UPDATE" | "SALE";
    target: ProductTarget;
    recipeId: string | null;
    orderItemId?: string;
    calculation: CostCalculation;
  }
) {
  await tx.productCostSnapshot.create({
    data: {
      source: input.source,
      targetType: input.target.targetType,
      targetKey: getTargetKey(input.target.targetType, input.target.targetId),
      recipeId: input.recipeId,
      menuItemId: input.target.menuItemId,
      variantId: input.target.variantId,
      orderItemId: input.orderItemId ?? null,
      salePriceVnd: BigInt(input.target.salePriceVnd),
      ingredientCostVnd: BigInt(input.calculation.ingredientCostVnd),
      packagingCostVnd: BigInt(input.calculation.packagingCostVnd),
      totalCostVnd: BigInt(input.calculation.totalCostVnd),
      grossMarginVnd: BigInt(input.calculation.grossMarginVnd),
      grossMarginPercent: toDecimal(input.calculation.grossMarginPercent),
      lowMarginThresholdPercent: toDecimal(input.calculation.lowMarginThresholdPercent),
      isLowMargin: input.calculation.isLowMargin
    }
  });
}

async function getLatestUnitCostByInventoryItemIds(inventoryItemIds: string[]) {
  const db = getDb();
  return getLatestUnitCostByInventoryItemIdsInTransaction(db, inventoryItemIds);
}

async function getLatestUnitCostByInventoryItemIdsInTransaction(tx: Prisma.TransactionClient | ReturnType<typeof getDb>, inventoryItemIds: string[]) {
  const latestCosts = new Map<string, number>();
  if (!inventoryItemIds.length) return latestCosts;

  const records = await tx.inventoryPurchaseRecord.findMany({
    where: {
      inventoryItemId: { in: inventoryItemIds },
      unitCostVnd: { not: null }
    },
    orderBy: [{ inventoryItemId: "asc" }, { purchaseDate: "desc" }, { createdAt: "desc" }]
  });

  for (const record of records) {
    if (!latestCosts.has(record.inventoryItemId) && record.unitCostVnd !== null) {
      latestCosts.set(record.inventoryItemId, toNumber(record.unitCostVnd));
    }
  }

  return latestCosts;
}

async function getOrCreateDefaultMarginRule() {
  const db = getDb();
  return getOrCreateDefaultMarginRuleInTransaction(db);
}

async function getOrCreateDefaultMarginRuleInTransaction(tx: Prisma.TransactionClient | ReturnType<typeof getDb>) {
  return tx.productMarginRule.upsert({
    where: { name: DEFAULT_MARGIN_RULE_NAME },
    create: {
      name: DEFAULT_MARGIN_RULE_NAME,
      thresholdPercent: toDecimal(DEFAULT_LOW_MARGIN_THRESHOLD_PERCENT),
      isActive: true
    },
    update: {
      isActive: true
    }
  });
}

function mapRecipe(recipe: RecipeWithIngredients, latestUnitCostByItemId: Map<string, number>): ProductRecipeDto {
  return {
    id: recipe.id,
    targetType: recipe.targetType,
    targetId: recipe.variantId ?? recipe.menuItemId,
    menuItemId: recipe.menuItemId,
    variantId: recipe.variantId,
    packagingCostVnd: toNumber(recipe.packagingCostVnd),
    note: recipe.note,
    ingredients: recipe.ingredients.map((ingredient) => {
      const latestUnitCostVnd = latestUnitCostByItemId.get(ingredient.inventoryItemId) ?? null;
      return {
        id: ingredient.id,
        inventoryItemId: ingredient.inventoryItemId,
        inventoryItemName: ingredient.inventoryItem.name,
        inventoryItemUnit: ingredient.inventoryItem.unit,
        quantity: ingredient.quantity.toNumber(),
        unit: ingredient.unit,
        wastePercent: ingredient.wastePercent.toNumber(),
        latestUnitCostVnd,
        lineCostVnd:
          latestUnitCostVnd === null
            ? 0
            : calculateIngredientLineCost({
                quantity: ingredient.quantity,
                wastePercent: ingredient.wastePercent,
                unitCostVnd: latestUnitCostVnd
              }),
        sortOrder: ingredient.sortOrder
      };
    }),
    updatedAt: recipe.updatedAt.toISOString()
  };
}

function mapMarginRule(rule: { id: string; thresholdPercent: Prisma.Decimal; updatedAt: Date }): ProductMarginRuleDto {
  return {
    id: rule.id,
    thresholdPercent: rule.thresholdPercent.toNumber(),
    updatedAt: rule.updatedAt.toISOString()
  };
}

function calculateIngredientLineCost({
  quantity,
  wastePercent,
  unitCostVnd
}: {
  quantity: Prisma.Decimal;
  wastePercent: Prisma.Decimal;
  unitCostVnd: number;
}) {
  const effectiveQuantity = quantity.mul(wastePercent.div(100).plus(1));
  return Math.round(effectiveQuantity.mul(unitCostVnd).toNumber());
}

function getTargetKey(targetType: ProductRecipeTargetType, targetId: string) {
  return `${targetType}:${targetId}`;
}

function toDecimal(value: number) {
  return new Prisma.Decimal(value.toString());
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function toNumber(value: bigint | number | Prisma.Decimal | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return value.toNumber();
}
