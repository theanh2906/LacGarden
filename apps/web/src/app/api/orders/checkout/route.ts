import { NextResponse } from "next/server";
import { checkoutOrder, getPosErrorMessage, PosServiceError } from "@/server/pos";
import { checkoutOrderSchema } from "@/server/pos-validation";

export async function POST(request: Request) {
  try {
    const input = checkoutOrderSchema.parse(await request.json());
    const data = await checkoutOrder(input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.info("[pos-api] Order checkout failed", error);
    return NextResponse.json(
      {
        error: {
          code: error instanceof PosServiceError ? "CHECKOUT_BUSINESS_ERROR" : "CHECKOUT_ERROR",
          message: getPosErrorMessage(error)
        }
      },
      { status: 400 }
    );
  }
}
