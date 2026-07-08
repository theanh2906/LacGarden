import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/server/auth";
import { runTimesheetAction } from "@/server/staff-ops";
import { timesheetActionSchema } from "@/server/staff-ops-validation";
import { toStaffOpsErrorResponse } from "../error-response";

export async function POST(request: Request) {
  try {
    const session = await requireStaffPermission("payroll:manage");
    const input = timesheetActionSchema.parse(await request.json());
    const data = await runTimesheetAction(input, { staffId: session.staff.id });
    return NextResponse.json({ data });
  } catch (error) {
    return toStaffOpsErrorResponse(error);
  }
}
