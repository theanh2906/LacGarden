import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { confirmImportBatch } from "@/server/inventory-import";
import { confirmImportSchema } from "@/server/inventory-validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaffPermission("inventory:manage");
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const input = confirmImportSchema.parse(body);
    const data = await confirmImportBatch(id, input, { createdById: session.staff.id });
    return NextResponse.json({ data });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.info("[inventory-api] Import confirm failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Import confirmation is invalid.", details: error.flatten() } },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: { code: "IMPORT_CONFIRM_ERROR", message: "Unable to confirm import." } }, { status: 400 });
  }
}
