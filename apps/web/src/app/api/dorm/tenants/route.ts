import { requireStaffPermission } from "@/server/auth";
import { createDormTenant } from "@/server/dorm";
import { createDormTenantSchema } from "@/server/dorm-validation";
import { toDormErrorResponse } from "../error-response";

export async function POST(request: Request) {
  try {
    await requireStaffPermission("dorm:manage");
    return Response.json({ data: await createDormTenant(createDormTenantSchema.parse(await request.json())) }, { status: 201 });
  } catch (error) {
    return toDormErrorResponse(error);
  }
}
