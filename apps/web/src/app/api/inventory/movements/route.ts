import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import {
  createInventoryStockMovement,
  getInventoryErrorMessage,
  InventoryServiceError,
  listInventoryStockMovements
} from "@/server/inventory";
import { createStockMovementSchema } from "@/server/inventory-validation";

export async function GET() {
  try {
    await requireStaffPermission("inventory:manage");
    const data = await listInventoryStockMovements({ limit: 50 });

    return NextResponse.json({ data });
  } catch (error) {
    return toInventoryErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffPermission("inventory:manage");
    const body = await request.json();
    const input = createStockMovementSchema.parse(body);
    const data = await createInventoryStockMovement({ ...input, createdById: session.staff.id });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toInventoryErrorResponse(error);
  }
}

function toInventoryErrorResponse(error: unknown) {
  const authResponse = authErrorResponse(error);
  if (authResponse) return authResponse;

  console.info("[inventory-api] Stock movement request failed", error);

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu biến động kho không hợp lệ.",
          details: error.flatten()
        }
      },
      { status: 400 }
    );
  }

  if (error instanceof InventoryServiceError) {
    return NextResponse.json(
      {
        error: {
          code: "INVENTORY_RULE_ERROR",
          message: error.message
        }
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "STOCK_MOVEMENT_ERROR",
        message: getInventoryErrorMessage(error)
      }
    },
    { status: 400 }
  );
}
