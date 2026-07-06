import { NextResponse } from "next/server";
import { z } from "zod";
import { createInventoryItem, getInventoryErrorMessage, listInventoryItems } from "@/server/inventory";
import { createInventoryItemSchema, inventoryStatusFilterSchema } from "@/server/inventory-validation";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = inventoryStatusFilterSchema.parse(searchParams.get("status") ?? "all");
    const q = searchParams.get("q");
    const data = await listInventoryItems({ status, q });

    return NextResponse.json({ data });
  } catch (error) {
    return toInventoryErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = createInventoryItemSchema.parse(body);
    const data = await createInventoryItem(input);

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toInventoryErrorResponse(error);
  }
}

function toInventoryErrorResponse(error: unknown) {
  console.info("[inventory-api] Inventory items request failed", error);

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Inventory item input is invalid.",
          details: error.flatten()
        }
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "INVENTORY_ITEM_ERROR",
        message: getInventoryErrorMessage(error)
      }
    },
    { status: 400 }
  );
}
