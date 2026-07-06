import { NextResponse } from "next/server";
import { z } from "zod";
import { getInventoryErrorMessage, updateInventoryItem } from "@/server/inventory";
import { updateInventoryItemSchema } from "@/server/inventory-validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = updateInventoryItemSchema.parse(body);
    const data = await updateInventoryItem(id, input);

    return NextResponse.json({ data });
  } catch (error) {
    return toInventoryErrorResponse(error);
  }
}

function toInventoryErrorResponse(error: unknown) {
  console.info("[inventory-api] Inventory item update failed", error);

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Inventory item update is invalid.",
          details: error.flatten()
        }
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "INVENTORY_ITEM_UPDATE_ERROR",
        message: getInventoryErrorMessage(error)
      }
    },
    { status: 400 }
  );
}
