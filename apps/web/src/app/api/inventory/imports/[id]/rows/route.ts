import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireStaffPermission } from "@/server/auth";
import { updateImportRows } from "@/server/inventory-import";
import { updateImportRowsSchema } from "@/server/inventory-validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffPermission("inventory:manage");
    const { id } = await params;
    const input = updateImportRowsSchema.parse(await request.json());
    const data = await updateImportRows(id, input);
    return NextResponse.json({ data });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.info("[inventory-api] Import row update failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Import row update is invalid.", details: error.flatten() } },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: { code: "IMPORT_ROW_UPDATE_ERROR", message: "Unable to update import rows." } }, { status: 400 });
  }
}
