import { NextResponse } from "next/server";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { getSalesReport } from "@/server/pos";

export async function GET() {
  try {
    await requireStaffPermission("reports:view");
    const data = await getSalesReport();
    return NextResponse.json({ data });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.info("[pos-api] Sales report request failed", error);
    return NextResponse.json({
      data: {
        revenueToday: 0,
        orderCount: 0,
        averageOrderValue: 0,
        cashPercent: 0,
        transferPercent: 0,
        topProducts: []
      }
    });
  }
}
