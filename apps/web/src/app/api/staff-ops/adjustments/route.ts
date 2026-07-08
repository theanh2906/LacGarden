import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/server/auth";
import { createTimesheetAdjustment } from "@/server/staff-ops";
import { createTimesheetAdjustmentSchema } from "@/server/staff-ops-validation";
import { toStaffOpsErrorResponse } from "../error-response";

export async function POST(request: Request) {
  try {
    const session = await requireStaffPermission("payroll:manage");
    const input = createTimesheetAdjustmentSchema.parse(await request.json());
    const data = await createTimesheetAdjustment(input, { staffId: session.staff.id });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toStaffOpsErrorResponse(error);
  }
}
