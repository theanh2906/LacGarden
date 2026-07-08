import { NextResponse } from "next/server";
import { getStaffClientPermissions, getStaffSession } from "@/server/auth";

export async function GET() {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ data: null }, { status: 401 });
  }

  return NextResponse.json({
    data: {
      staff: {
        username: session.staff.username,
        displayName: session.staff.displayName,
        role: session.staff.role
      },
      permissions: getStaffClientPermissions(session.staff.role),
      expiresAt: session.expiresAt
    }
  });
}
