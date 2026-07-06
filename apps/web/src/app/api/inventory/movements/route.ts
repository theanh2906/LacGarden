import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createInventoryStockMovement,
  getInventoryErrorMessage,
  InventoryServiceError,
  listInventoryStockMovements
} from "@/server/inventory";
import { createStockMovementSchema } from "@/server/inventory-validation";

export async function GET() {
  try {
    const data = await listInventoryStockMovements({ limit: 50 });

    return NextResponse.json({ data });
  } catch (error) {
    return toInventoryErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = createStockMovementSchema.parse(body);
    const data = await createInventoryStockMovement(input);

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toInventoryErrorResponse(error);
  }
}

function toInventoryErrorResponse(error: unknown) {
  console.info("[inventory-api] Stock movement request failed", error);

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Stock movement input is invalid.",
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
