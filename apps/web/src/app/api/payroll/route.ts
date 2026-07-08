import { requireStaffPermission } from "@/server/auth";
import { generatePayrollRun, getPayrollSnapshot } from "@/server/payroll";
import { generatePayrollRunSchema, payrollQuerySchema } from "@/server/payroll-validation";
import { toPayrollErrorResponse } from "./error-response";

export async function GET(request: Request) {
  try {
    await requireStaffPermission("payroll:manage");
    const query = payrollQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const data = await getPayrollSnapshot(query);
    return Response.json({ data });
  } catch (error) {
    return toPayrollErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffPermission("payroll:manage");
    const input = generatePayrollRunSchema.parse(await request.json());
    const data = await generatePayrollRun(input, { staffId: session.staff.id });
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    return toPayrollErrorResponse(error);
  }
}
