import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { getEmptyInventoryReport, getInventoryReport, parseInventoryReportSearchParams } from "@/server/inventory-reports";

export async function GET(request: Request) {
  try {
    await requireStaffPermission("reports:view");
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }

  let query: ReturnType<typeof parseInventoryReportSearchParams>;
  try {
    query = parseInventoryReportSearchParams(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Inventory report filters are invalid.", details: error.flatten() } },
        { status: 400 }
      );
    }
    console.info("[inventory-api] Inventory report filter parsing failed", error);
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Inventory report filters are invalid." } },
      { status: 400 }
    );
  }

  try {
    const data = await getInventoryReport(query);
    return NextResponse.json({ data });
  } catch (error) {
    console.info("[inventory-api] Inventory report request failed", error);
    return NextResponse.json({ data: getEmptyInventoryReport(query) });
  }
}
