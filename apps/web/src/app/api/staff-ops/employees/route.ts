import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/server/auth";
import { upsertEmployeeProfile } from "@/server/staff-ops";
import { upsertEmployeeProfileSchema } from "@/server/staff-ops-validation";
import { toStaffOpsErrorResponse } from "../error-response";

export async function POST(request: Request) {
  try {
    await requireStaffPermission("payroll:manage");
    const input = upsertEmployeeProfileSchema.parse(await request.json());
    const data = await upsertEmployeeProfile(input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return toStaffOpsErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireStaffPermission("payroll:manage");
    const input = upsertEmployeeProfileSchema.parse(await request.json());
    const data = await upsertEmployeeProfile(input);
    return NextResponse.json({ data });
  } catch (error) {
    return toStaffOpsErrorResponse(error);
  }
}
