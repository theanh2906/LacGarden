import { NextResponse } from "next/server";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { getInventoryErrorMessage, getInventoryItemMovements } from "@/server/inventory";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffPermission("inventory:manage");
    const { id } = await params;
    const data = await getInventoryItemMovements(id);

    return NextResponse.json({ data });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

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
