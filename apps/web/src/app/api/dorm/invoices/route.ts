import { requireStaffPermission } from "@/server/auth";
import { createDormInvoice } from "@/server/dorm";
import { createDormInvoiceSchema } from "@/server/dorm-validation";
import { toDormErrorResponse } from "../error-response";

export async function POST(request: Request) {
  try {
    await requireStaffPermission("dorm:manage");
    return Response.json({ data: await createDormInvoice(createDormInvoiceSchema.parse(await request.json())) }, { status: 201 });
  } catch (error) {
    return toDormErrorResponse(error);
  }
}
