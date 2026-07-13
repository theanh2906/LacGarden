import { requireStaffPermission } from "@/server/auth";
import { createDormLease } from "@/server/dorm";
import { createDormLeaseSchema } from "@/server/dorm-validation";
import { toDormErrorResponse } from "../error-response";

export async function POST(request: Request) {
  try {
    const session = await requireStaffPermission("dorm:manage");
    const input = createDormLeaseSchema.parse(await request.json());
    return Response.json({ data: await createDormLease(input, session.staff.id) }, { status: 201 });
  } catch (error) {
    return toDormErrorResponse(error);
  }
}
