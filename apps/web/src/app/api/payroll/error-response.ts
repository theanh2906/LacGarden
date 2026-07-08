import { ZodError } from "zod";
import { authErrorResponse } from "@/server/auth";
import { getPayrollErrorMessage, PayrollServiceError } from "@/server/payroll";

export function toPayrollErrorResponse(error: unknown) {
  const authResponse = authErrorResponse(error);
  if (authResponse) return authResponse;

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Payroll input is invalid.",
          details: error.flatten()
        }
      },
      { status: 400 }
    );
  }

  console.info("[payroll-api] Request failed", error);
  return Response.json(
    {
      error: {
        code: error instanceof PayrollServiceError ? "PAYROLL_BUSINESS_ERROR" : "PAYROLL_ERROR",
        message: getPayrollErrorMessage(error)
      }
    },
    { status: 400 }
  );
}
