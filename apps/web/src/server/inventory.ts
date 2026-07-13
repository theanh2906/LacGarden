import { Prisma } from "@prisma/client";
import { getDb } from "@/server/db";
import type {
  CreateInventoryItemInput,
  CreateStockMovementInput,
  UpdateInventoryItemInput
} from "@/server/inventory-validation";
import type {
  InventoryAdminSnapshot,
  InventoryAlertState,
  InventoryItemDto,
  InventoryStatusFilter,
  InventoryStockMovementDto,
  InventorySummaryDto
} from "@/types/inventory";

const RECENT_MOVEMENT_LIMIT = 12;

type InventoryItemWithCount = Prisma.InventoryItemGetPayload<{
  include: { _count: { select: { stockMovements: true } } };
}>;

type InventoryStockMovementWithItem = Prisma.InventoryStockMovementGetPayload<{
  include: { inventoryItem: { select: { name: true } } };
}>;

export async function getInventoryAdminSnapshot(): Promise<InventoryAdminSnapshot> {
  const [items, recentMovements] = await Promise.all([
    listInventoryItems({ status: "all" }),
    listInventoryStockMovements({ limit: RECENT_MOVEMENT_LIMIT })
  ]);

  return {
    items,
    recentMovements,
    summary: calculateInventorySummary(items)
  };
}

export async function listInventoryItems({
  status = "all",
  q
}: {
  status?: InventoryStatusFilter;
  q?: string | null;
} = {}): Promise<InventoryItemDto[]> {
  const normalizedQuery = q?.trim();
  const db = getDb();
  const items = await db.inventoryItem.findMany({
    where: normalizedQuery
      ? {
          OR: [
            { name: { contains: normalizedQuery, mode: "insensitive" } },
            { code: { contains: normalizedQuery, mode: "insensitive" } },
            { unit: { contains: normalizedQuery, mode: "insensitive" } }
          ]
        }
      : undefined,
    include: {
      _count: {
        select: {
          stockMovements: true
        }
      }
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }]
  });

  return items.map(mapInventoryItem).filter((item) => matchesStatusFilter(item, status));
}

export async function getInventoryItemMovements(inventoryItemId: string): Promise<InventoryStockMovementDto[]> {
  return listInventoryStockMovements({ inventoryItemId, limit: 100 });
}

export async function createInventoryItem(input: CreateInventoryItemInput): Promise<InventoryItemDto> {
  const db = getDb();
  const currentQuantity = toDecimal(input.currentQuantity);

  const item = await db.$transaction(async (tx) => {
    const created = await tx.inventoryItem.create({
      data: {
        name: input.name,
        code: input.code,
        unit: input.unit,
        currentQuantity,
        lowStockThreshold: toDecimal(input.lowStockThreshold),
        note: input.note
      },
      include: {
        _count: {
          select: {
            stockMovements: true
          }
        }
      }
    });

    if (!currentQuantity.isZero()) {
      await tx.inventoryStockMovement.create({
        data: {
          inventoryItemId: created.id,
          movementType: "CORRECTION",
          quantityDelta: currentQuantity,
          quantityBefore: new Prisma.Decimal(0),
          quantityAfter: currentQuantity,
          note: "Opening stock"
        }
      });
    }

    return tx.inventoryItem.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        _count: {
          select: {
            stockMovements: true
          }
        }
      }
    });
  });

  return mapInventoryItem(item);
}

export async function updateInventoryItem(id: string, input: UpdateInventoryItemInput): Promise<InventoryItemDto> {
  const db = getDb();
  const item = await db.inventoryItem.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.lowStockThreshold !== undefined ? { lowStockThreshold: toDecimal(input.lowStockThreshold) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.note !== undefined ? { note: input.note } : {})
    },
    include: {
      _count: {
        select: {
          stockMovements: true
        }
      }
    }
  });

  return mapInventoryItem(item);
}

export async function createInventoryStockMovement(input: CreateStockMovementInput): Promise<{
  item: InventoryItemDto;
  movement: InventoryStockMovementDto;
}> {
  const db = getDb();

  const result = await db.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUniqueOrThrow({
      where: { id: input.inventoryItemId }
    });

    if (!item.isActive) {
      throw new InventoryServiceError("Không thể ghi biến động cho nguyên liệu đã ngưng dùng.");
    }

    const quantityBefore = item.currentQuantity;
    const quantityDelta = resolveQuantityDelta(input, quantityBefore);
    const quantityAfter = quantityBefore.plus(quantityDelta);

    if (quantityAfter.lt(0)) {
      throw new InventoryServiceError("Số lượng tồn kho không thể nhỏ hơn 0.");
    }

    const purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : null;
    if (input.movementType === "PURCHASE" && !purchaseDate) {
      throw new InventoryServiceError("Ngày mua là bắt buộc cho biến động nhập mua.");
    }

    const movement = await tx.inventoryStockMovement.create({
      data: {
        inventoryItemId: item.id,
        movementType: input.movementType,
        quantityDelta,
        quantityBefore,
        quantityAfter,
        purchaseDate,
        unitCostVnd: input.unitCostVnd ?? null,
        totalCostVnd: input.totalCostVnd ?? calculateTotalCost(input.unitCostVnd, quantityDelta),
        note: input.note,
        createdById: input.createdById ?? null
      },
      include: {
        inventoryItem: {
          select: {
            name: true
          }
        }
      }
    });

    if (input.movementType === "PURCHASE") {
      await tx.inventoryPurchaseRecord.create({
        data: {
          inventoryItemId: item.id,
          stockMovementId: movement.id,
          purchaseDate: purchaseDate as Date,
          unitCostVnd: movement.unitCostVnd,
          totalCostVnd: movement.totalCostVnd,
          note: input.note
        }
      });
    }

    const updatedItem = await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        currentQuantity: quantityAfter
      },
      include: {
        _count: {
          select: {
            stockMovements: true
          }
        }
      }
    });

    return {
      item: updatedItem,
      movement
    };
  });

  return {
    item: mapInventoryItem(result.item),
    movement: mapInventoryStockMovement(result.movement)
  };
}

export async function listInventoryStockMovements({
  inventoryItemId,
  limit
}: {
  inventoryItemId?: string;
  limit?: number;
} = {}): Promise<InventoryStockMovementDto[]> {
  const db = getDb();
  const movements = await db.inventoryStockMovement.findMany({
    where: inventoryItemId ? { inventoryItemId } : undefined,
    include: {
      inventoryItem: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });

  return movements.map(mapInventoryStockMovement);
}

export class InventoryServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryServiceError";
  }
}

export function getInventoryErrorMessage(error: unknown) {
  if (error instanceof InventoryServiceError) {
    return error.message;
  }

  return "Thao tác kho thất bại. Kiểm tra nhật ký quản trị để biết chi tiết.";
}

function resolveQuantityDelta(input: CreateStockMovementInput, currentQuantity: Prisma.Decimal): Prisma.Decimal {
  if (input.movementType === "CORRECTION") {
    if (input.finalQuantity === undefined) {
      throw new InventoryServiceError("Số lượng thực tế là bắt buộc khi kiểm kho.");
    }
    return toDecimal(input.finalQuantity).minus(currentQuantity);
  }

  if (input.movementType === "PURCHASE") {
    const delta = toDecimal(input.quantity ?? input.quantityDelta ?? 0);
    if (delta.lte(0)) {
      throw new InventoryServiceError("Số lượng nhập mua phải lớn hơn 0.");
    }
    return delta;
  }

  if (input.movementType === "WASTE") {
    const delta = toDecimal(input.quantity ?? Math.abs(input.quantityDelta ?? 0)).mul(-1);
    if (delta.gte(0)) {
      throw new InventoryServiceError("Số lượng hao hụt phải lớn hơn 0.");
    }
    return delta;
  }

  const delta = toDecimal(input.quantityDelta ?? 0);
  if (delta.isZero()) {
    throw new InventoryServiceError("Số lượng điều chỉnh không được bằng 0.");
  }
  return delta;
}

function calculateTotalCost(unitCostVnd: number | undefined, quantityDelta: Prisma.Decimal) {
  if (unitCostVnd === undefined) return null;
  return Math.round(unitCostVnd * quantityDelta.abs().toNumber());
}

function calculateInventorySummary(items: InventoryItemDto[]): InventorySummaryDto {
  return items.reduce<InventorySummaryDto>(
    (summary, item) => {
      summary.totalItems += 1;
      if (item.isActive) summary.activeItems += 1;
      if (!item.isActive) summary.inactiveItems += 1;
      if (item.alertState === "LOW_STOCK") summary.lowStockItems += 1;
      if (item.alertState === "OUT_OF_STOCK") summary.outOfStockItems += 1;
      return summary;
    },
    {
      totalItems: 0,
      activeItems: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      inactiveItems: 0,
      stockValueVnd: 0
    }
  );
}

function mapInventoryItem(item: InventoryItemWithCount): InventoryItemDto {
  const currentQuantity = item.currentQuantity.toNumber();
  const lowStockThreshold = item.lowStockThreshold.toNumber();

  return {
    id: item.id,
    name: item.name,
    code: item.code,
    unit: item.unit,
    currentQuantity,
    lowStockThreshold,
    isActive: item.isActive,
    note: item.note,
    alertState: getInventoryAlertState({
      isActive: item.isActive,
      currentQuantity,
      lowStockThreshold
    }),
    movementCount: item._count.stockMovements,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function mapInventoryStockMovement(movement: InventoryStockMovementWithItem): InventoryStockMovementDto {
  return {
    id: movement.id,
    inventoryItemId: movement.inventoryItemId,
    itemName: movement.inventoryItem.name,
    movementType: movement.movementType,
    quantityDelta: movement.quantityDelta.toNumber(),
    quantityBefore: movement.quantityBefore.toNumber(),
    quantityAfter: movement.quantityAfter.toNumber(),
    purchaseDate: movement.purchaseDate?.toISOString() ?? null,
    unitCostVnd: toNullableNumber(movement.unitCostVnd),
    totalCostVnd: toNullableNumber(movement.totalCostVnd),
    note: movement.note,
    createdAt: movement.createdAt.toISOString()
  };
}

function getInventoryAlertState({
  isActive,
  currentQuantity,
  lowStockThreshold
}: {
  isActive: boolean;
  currentQuantity: number;
  lowStockThreshold: number;
}): InventoryAlertState {
  if (!isActive) return "INACTIVE";
  if (lowStockThreshold <= 0) return "OK";
  if (currentQuantity <= 0) return "OUT_OF_STOCK";
  if (currentQuantity <= lowStockThreshold) return "LOW_STOCK";
  return "OK";
}

function matchesStatusFilter(item: InventoryItemDto, status: InventoryStatusFilter) {
  if (status === "all") return true;
  if (status === "active") return item.isActive;
  if (status === "inactive") return !item.isActive;
  if (status === "low-stock") return item.alertState === "LOW_STOCK";
  if (status === "out-of-stock") return item.alertState === "OUT_OF_STOCK";
  return true;
}

function toDecimal(value: number) {
  return new Prisma.Decimal(value.toString());
}

function toNullableNumber(value: bigint | number | null) {
  if (value === null) return null;
  return typeof value === "bigint" ? Number(value) : value;
}
