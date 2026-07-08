import { requireStaffPermission } from "@/server/auth";
import { reviewPayrollRun } from "@/server/payroll";
import { reviewPayrollRunSchema } from "@/server/payroll-validation";
import { toPayrollErrorResponse } from "../error-response";

export async function POST(request: Request) {
  try {
    const session = await requireStaffPermission("payroll:manage");
    const input = reviewPayrollRunSchema.parse(await request.json());
    const data = await reviewPayrollRun(input, { staffId: session.staff.id });
    return Response.json({ data });
  } catch (error) {
    return toPayrollErrorResponse(error);
  }
}
