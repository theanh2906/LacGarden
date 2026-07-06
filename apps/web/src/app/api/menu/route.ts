import { NextResponse } from "next/server";
import { listMenu } from "@/server/pos";

export async function GET() {
  try {
    const data = await listMenu();
    return NextResponse.json({ data });
  } catch (error) {
    console.info("[pos-api] Menu request failed", error);
    return NextResponse.json({ data: { menuCategories: [{ id: "all", name: "Tất cả" }], menuItems: [] } });
  }
}
