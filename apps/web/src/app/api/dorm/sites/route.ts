import { requireStaffPermission } from "@/server/auth";
import { createDormSite } from "@/server/dorm";
import { createDormSiteSchema } from "@/server/dorm-validation";
import { toDormErrorResponse } from "../error-response";

export async function POST(request: Request) {
  try {
    await requireStaffPermission("dorm:manage");
    return Response.json({ data: await createDormSite(createDormSiteSchema.parse(await request.json())) }, { status: 201 });
  } catch (error) {
    return toDormErrorResponse(error);
  }
}
