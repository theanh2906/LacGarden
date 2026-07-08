import { NextResponse } from "next/server";
import { requireStaffSession } from "@/server/auth";
import { clockIn, clockOut } from "@/server/staff-ops";
import { clockActionSchema, clockOutSchema } from "@/server/staff-ops-validation";
import { toStaffOpsErrorResponse } from "../error-response";

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession();
    const body = await request.json().catch(() => ({}));
    const { action } = clockActionSchema.parse(body);
    if (action === "out") {
      const input = clockOutSchema.parse(body);
      const data = await clockOut(input, { staffId: session.staff.id });
      return NextResponse.json({ data });
    }
    const data = await clockIn({ staffId: session.staff.id });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toStaffOpsErrorResponse(error);
  }
}
