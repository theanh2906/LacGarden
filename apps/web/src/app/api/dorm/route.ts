import { requireStaffPermission } from "@/server/auth";
import { getDormSnapshot } from "@/server/dorm";
import { toDormErrorResponse } from "./error-response";

export async function GET() {
  try {
    await requireStaffPermission("dorm:manage");
    return Response.json({ data: await getDormSnapshot() });
  } catch (error) {
    return toDormErrorResponse(error);
  }
}
