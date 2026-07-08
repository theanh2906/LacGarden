import { NextResponse } from "next/server";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { getPosErrorMessage, PosServiceError, updateOrderStatus } from "@/server/pos";
import { updateOrderStatusSchema } from "@/server/pos-validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireStaffPermission("bar:manage");
    const input = updateOrderStatusSchema.parse(await request.json());
    const data = await updateOrderStatus(id, input);
    return NextResponse.json({ data });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.info("[pos-api] Order status update failed", error);
    return NextResponse.json(
      {
        error: {
          code: error instanceof PosServiceError ? "ORDER_STATUS_BUSINESS_ERROR" : "ORDER_STATUS_UPDATE_ERROR",
          message: getPosErrorMessage(error)
        }
      },
      { status: 400 }
    );
  }
}
