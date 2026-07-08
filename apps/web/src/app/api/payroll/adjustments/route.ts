import { requireStaffPermission } from "@/server/auth";
import { createPayrollAdjustment } from "@/server/payroll";
import { createPayrollAdjustmentSchema } from "@/server/payroll-validation";
import { toPayrollErrorResponse } from "../error-response";

export async function POST(request: Request) {
  try {
    const session = await requireStaffPermission("payroll:manage");
    const input = createPayrollAdjustmentSchema.parse(await request.json());
    const data = await createPayrollAdjustment(input, { staffId: session.staff.id });
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    return toPayrollErrorResponse(error);
  }
}
