import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireStaffPermission, requireStaffSession } from "@/server/auth";
import {
  getProductCostingAdminSnapshot,
  getProductCostingErrorMessage,
  upsertProductRecipe
} from "@/server/costing";
import { upsertProductRecipeSchema } from "@/server/costing-validation";

export async function GET() {
  try {
    await requireStaffSession();
    const data = await getProductCostingAdminSnapshot();
    return NextResponse.json({ data });
  } catch (error) {
    return toRecipeErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireStaffPermission("inventory:manage");
    const body = await request.json();
    const input = upsertProductRecipeSchema.parse(body);
    const data = await upsertProductRecipe(input);
    return NextResponse.json({ data });
  } catch (error) {
    return toRecipeErrorResponse(error);
  }
}

function toRecipeErrorResponse(error: unknown) {
  const authResponse = authErrorResponse(error);
  if (authResponse) return authResponse;

  console.info("[recipes-api] Request failed", error);

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu công thức không hợp lệ.",
          details: error.flatten()
        }
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "RECIPE_ERROR",
        message: getProductCostingErrorMessage(error)
      }
    },
    { status: 400 }
  );
}
