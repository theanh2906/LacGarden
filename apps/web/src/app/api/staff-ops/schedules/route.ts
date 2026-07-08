import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/server/auth";
import { upsertStaffSchedule } from "@/server/staff-ops";
import { upsertStaffScheduleSchema } from "@/server/staff-ops-validation";
import { toStaffOpsErrorResponse } from "../error-response";

export async function POST(request: Request) {
  try {
    const session = await requireStaffPermission("payroll:manage");
    const input = upsertStaffScheduleSchema.parse(await request.json());
    const data = await upsertStaffSchedule(input, { staffId: session.staff.id });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toStaffOpsErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireStaffPermission("payroll:manage");
    const input = upsertStaffScheduleSchema.parse(await request.json());
    const data = await upsertStaffSchedule(input, { staffId: session.staff.id });
    return NextResponse.json({ data });
  } catch (error) {
    return toStaffOpsErrorResponse(error);
  }
}
