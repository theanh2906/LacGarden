import { ZodError } from "zod";
import { authErrorResponse } from "@/server/auth";
import { DormServiceError, getDormErrorMessage } from "@/server/dorm";

export function toDormErrorResponse(error: unknown) {
  const authResponse = authErrorResponse(error);
  if (authResponse) return authResponse;
  if (error instanceof ZodError) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Dorm input is invalid.", details: error.flatten() } },
      { status: 400 }
    );
  }
  console.info("[dorm-api] Request failed", error);
  return Response.json(
    { error: { code: error instanceof DormServiceError ? "DORM_BUSINESS_ERROR" : "DORM_ERROR", message: getDormErrorMessage(error) } },
    { status: 400 }
  );
}
