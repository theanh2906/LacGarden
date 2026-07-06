import { NextResponse } from "next/server";
import { getInventoryErrorMessage, getInventoryItemMovements } from "@/server/inventory";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await getInventoryItemMovements(id);

    return NextResponse.json({ data });
  } catch (error) {
    console.info("[inventory-api] Inventory movement history request failed", error);

    return NextResponse.json(
      {
        error: {
          code: "INVENTORY_MOVEMENT_HISTORY_ERROR",
          message: getInventoryErrorMessage(error)
        }
      },
      { status: 400 }
    );
  }
}
