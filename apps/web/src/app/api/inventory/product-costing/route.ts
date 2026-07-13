import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import {
  getProductCostingAdminSnapshot,
  getProductCostingErrorMessage,
  updateProductMarginRule,
  upsertProductRecipe
} from "@/server/costing";
import { updateProductMarginRuleSchema, upsertProductRecipeSchema } from "@/server/costing-validation";

export async function GET() {
  try {
    await requireStaffPermission("inventory:manage");
    const data = await getProductCostingAdminSnapshot();
    return NextResponse.json({ data });
  } catch (error) {
    return toProductCostingErrorResponse(error);
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
    return toProductCostingErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireStaffPermission("inventory:manage");
    const body = await request.json();
    const input = updateProductMarginRuleSchema.parse(body);
    const data = await updateProductMarginRule(input);
    return NextResponse.json({ data });
  } catch (error) {
    return toProductCostingErrorResponse(error);
  }
}

function toProductCostingErrorResponse(error: unknown) {
  const authResponse = authErrorResponse(error);
  if (authResponse) return authResponse;

  console.info("[product-costing-api] Request failed", error);

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu giá vốn sản phẩm không hợp lệ.",
          details: error.flatten()
        }
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "PRODUCT_COSTING_ERROR",
        message: getProductCostingErrorMessage(error)
      }
    },
    { status: 400 }
  );
}
