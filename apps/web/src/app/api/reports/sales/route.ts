import { NextResponse } from "next/server";
import { getSalesReport } from "@/server/pos";

export async function GET() {
  try {
    const data = await getSalesReport();
    return NextResponse.json({ data });
  } catch (error) {
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
