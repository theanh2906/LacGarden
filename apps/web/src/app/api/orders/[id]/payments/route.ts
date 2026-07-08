import { NextResponse } from "next/server";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { addOrderPayment, getPosErrorMessage, PosServiceError } from "@/server/pos";
import { addPaymentSchema } from "@/server/pos-validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await requireStaffPermission("payments:collect");
    const input = addPaymentSchema.parse(await request.json());
    const data = await addOrderPayment(id, input, { staffId: session.staff.id });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.info("[pos-api] Payment create failed", error);
    return NextResponse.json(
      {
        error: {
          code: error instanceof PosServiceError ? "PAYMENT_BUSINESS_ERROR" : "PAYMENT_CREATE_ERROR",
          message: getPosErrorMessage(error)
        }
      },
      { status: 400 }
    );
  }
}
