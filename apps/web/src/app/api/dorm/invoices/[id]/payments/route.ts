import { requireStaffPermission } from "@/server/auth";
import { createDormPayment } from "@/server/dorm";
import { createDormPaymentSchema } from "@/server/dorm-validation";
import { toDormErrorResponse } from "../../../error-response";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaffPermission("dorm:manage");
    const { id } = await params;
    const input = createDormPaymentSchema.parse(await request.json());
    return Response.json({ data: await createDormPayment(id, input, session.staff.id) }, { status: 201 });
  } catch (error) {
    return toDormErrorResponse(error);
  }
}
