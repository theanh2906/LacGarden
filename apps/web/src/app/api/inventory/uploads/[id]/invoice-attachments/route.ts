import { NextResponse } from "next/server";
import { z } from "zod";
import { attachInvoiceUpload } from "@/server/inventory-import";

const attachInvoiceSchema = z.object({
  stockMovementId: z.string().uuid().nullable().optional(),
  purchaseRecordId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = attachInvoiceSchema.parse(await request.json());
    const data = await attachInvoiceUpload({
      uploadId: id,
      stockMovementId: input.stockMovementId,
      purchaseRecordId: input.purchaseRecordId,
      note: input.note
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.info("[inventory-api] Invoice attachment failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invoice attachment input is invalid.", details: error.flatten() } },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: { code: "INVOICE_ATTACHMENT_ERROR", message: "Unable to attach invoice upload." } }, { status: 400 });
  }
}
