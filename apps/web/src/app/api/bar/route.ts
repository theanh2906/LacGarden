import { NextResponse } from "next/server";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { listBarQueue } from "@/server/pos";

export async function GET() {
  try {
    await requireStaffPermission("pos:access");
    const data = await listBarQueue();
    return NextResponse.json({ data });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.info("[pos-api] Bar queue request failed", error);
    return NextResponse.json({ data: [] });
  }
}
