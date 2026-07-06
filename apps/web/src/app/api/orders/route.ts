import { NextResponse } from "next/server";
import { createOrder, getPosErrorMessage, listRecentOrders, PosServiceError } from "@/server/pos";
import { createOrderSchema } from "@/server/pos-validation";

export async function GET() {
  try {
    const data = await listRecentOrders();
    return NextResponse.json({ data });
  } catch (error) {
    console.info("[pos-api] Orders request failed", error);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(request: Request) {
  try {
    const input = createOrderSchema.parse(await request.json());
    const data = await createOrder(input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
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
