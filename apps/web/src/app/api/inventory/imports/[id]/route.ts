import { NextResponse } from "next/server";
import { getImportBatch } from "@/server/inventory-import";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await getImportBatch(id);
    return NextResponse.json({ data });
  } catch (error) {
    console.info("[inventory-api] Import batch load failed", error);
    return NextResponse.json({ error: { code: "IMPORT_BATCH_LOAD_ERROR", message: "Unable to load import batch." } }, { status: 400 });
  }
}
