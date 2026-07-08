import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/server/auth";
import { getStaffOpsSnapshot } from "@/server/staff-ops";
import { staffOpsQuerySchema } from "@/server/staff-ops-validation";
import { toStaffOpsErrorResponse } from "./error-response";

export async function GET(request: Request) {
  try {
    const session = await requireStaffPermission("payroll:manage");
    const query = staffOpsQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const data = await getStaffOpsSnapshot(query, { staffId: session.staff.id });
    return NextResponse.json({ data });
  } catch (error) {
    return toStaffOpsErrorResponse(error);
  }
}
