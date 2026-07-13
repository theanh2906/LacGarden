import { NextResponse } from "next/server";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { isBankTransferQrEnabled, PaymentQrConfigError } from "@/server/payment-qr";
import { checkoutOrderWithBankTransferQr, getPosErrorMessage, PosServiceError } from "@/server/pos";
import { qrCheckoutOrderSchema } from "@/server/pos-validation";

export async function POST(request: Request) {
  try {
    const session = await requireStaffPermission("payments:collect");
    if (!isBankTransferQrEnabled()) {
      return NextResponse.json(
        {
          error: {
            code: "QR_CHECKOUT_COMING_SOON",
            message: "Thanh toán QR sắp ra mắt. Vui lòng dùng tiền mặt hoặc thẻ."
          }
        },
        { status: 503 }
      );
    }

    const input = qrCheckoutOrderSchema.parse(await request.json());
    const data = await checkoutOrderWithBankTransferQr(input, { staffId: session.staff.id });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.info("[pos-api] QR checkout failed", error);
    return NextResponse.json(
      {
        error: {
          code:
            error instanceof PaymentQrConfigError
              ? "QR_CONFIG_ERROR"
              : error instanceof PosServiceError
                ? "QR_CHECKOUT_BUSINESS_ERROR"
                : "QR_CHECKOUT_ERROR",
          message: error instanceof PaymentQrConfigError ? error.message : getPosErrorMessage(error)
        }
      },
      { status: 400 }
    );
  }
}
