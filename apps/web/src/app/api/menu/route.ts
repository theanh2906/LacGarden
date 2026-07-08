import { NextResponse } from "next/server";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { listMenu } from "@/server/pos";

export async function GET() {
  try {
    await requireStaffPermission("pos:access");
    const data = await listMenu();
    return NextResponse.json({ data });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.info("[pos-api] Menu request failed", error);
    return NextResponse.json({ data: { menuCategories: [{ id: "all", name: "Tất cả" }], menuItems: [] } });
  }
}
