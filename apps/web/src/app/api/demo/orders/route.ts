import { NextResponse } from "next/server";
import { barQueue, recentOrders } from "@/data/mock-pos";

export async function GET() {
  return NextResponse.json({ data: recentOrders });
}

export async function POST() {
  return NextResponse.json({
    data: {
      id: `demo-${Date.now()}`,
      orderNo: "T-1030",
      status: "SENT",
      paymentStatus: "UNPAID",
      queue: barQueue
    }
  });
}
