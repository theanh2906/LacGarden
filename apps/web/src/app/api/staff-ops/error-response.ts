import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse } from "@/server/auth";
import { getStaffOpsErrorMessage } from "@/server/staff-ops";

export function toStaffOpsErrorResponse(error: unknown) {
  const authResponse = authErrorResponse(error);
  if (authResponse) return authResponse;

  console.info("[staff-ops-api] Request failed", error);

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu thao tác nhân sự không hợp lệ.",
          details: error.flatten()
        }
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "STAFF_OPS_ERROR",
        message: getStaffOpsErrorMessage(error)
      }
    },
    { status: 400 }
  );
}
