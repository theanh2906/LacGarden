import { NextResponse } from "next/server";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { createOrder, getPosErrorMessage, listRecentOrders, PosServiceError } from "@/server/pos";
import { createOrderSchema } from "@/server/pos-validation";

export async function GET() {
  try {
    await requireStaffPermission("pos:access");
    const data = await listRecentOrders();
    return NextResponse.json({ data });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.info("[pos-api] Orders request failed", error);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffPermission("orders:manage");
    const input = createOrderSchema.parse(await request.json());
    const data = await createOrder(input, { staffId: session.staff.id });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.info("[pos-api] Order create failed", error);
    return NextResponse.json(
      {
        error: {
          code: error instanceof PosServiceError ? "ORDER_BUSINESS_ERROR" : "ORDER_CREATE_ERROR",
          message: getPosErrorMessage(error)
        }
      },
      { status: 400 }
    );
  }
}
