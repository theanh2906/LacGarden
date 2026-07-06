import { NextResponse } from "next/server";
import {
  createImportBatchFromUpload,
  InventoryImportError,
  saveInventoryUpload
} from "@/server/inventory-import";
import type { InventoryUploadType } from "@/types/inventory";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const uploadType = String(formData.get("uploadType") ?? "IMPORT").toUpperCase() as InventoryUploadType;
    const parse = String(formData.get("parse") ?? "false") === "true";
    const parser = String(formData.get("parser") ?? "auto") as "auto" | "deterministic" | "gemini";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: { code: "UPLOAD_FILE_REQUIRED", message: "A file is required." } }, { status: 400 });
    }

    if (uploadType !== "IMPORT" && uploadType !== "INVOICE") {
      return NextResponse.json({ error: { code: "UPLOAD_TYPE_INVALID", message: "uploadType must be IMPORT or INVOICE." } }, { status: 400 });
    }

    const upload = await saveInventoryUpload({ file, uploadType });
    const batch = uploadType === "IMPORT" && parse ? await createImportBatchFromUpload({ uploadId: upload.id, parserPreference: parser }) : null;

    return NextResponse.json({ data: { upload, batch } }, { status: 201 });
  } catch (error) {
    console.info("[inventory-api] Upload failed", error);
    return NextResponse.json(
      {
        error: {
          code: error instanceof InventoryImportError ? "INVENTORY_UPLOAD_ERROR" : "INVENTORY_UPLOAD_SYSTEM_ERROR",
          message: error instanceof InventoryImportError ? error.message : "Unable to store upload. Check admin logs for details."
        }
      },
      { status: 400 }
    );
  }
}
