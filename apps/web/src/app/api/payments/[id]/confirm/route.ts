import { NextResponse } from "next/server";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { confirmPaymentManually, getPosErrorMessage, PosServiceError } from "@/server/pos";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await requireStaffPermission("payments:collect");
    const data = await confirmPaymentManually(id, { staffId: session.staff.id });
    return NextResponse.json({ data });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.info("[pos-api] Manual payment confirm failed", error);
    return NextResponse.json(
      {
        error: {
          code: error instanceof PosServiceError ? "PAYMENT_CONFIRM_BUSINESS_ERROR" : "PAYMENT_CONFIRM_ERROR",
          message: getPosErrorMessage(error)
        }
      },
      { status: 400 }
    );
  }
}
