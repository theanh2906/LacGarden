import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { z } from "zod";
import { getDb } from "@/server/db";
import type { ConfirmImportInput, UpdateImportRowsInput } from "@/server/inventory-validation";
import type {
  InventoryImportBatchDto,
  InventoryImportConfirmResultDto,
  InventoryImportParserUsed,
  InventoryImportRowDto,
  InventoryImportRowStatus,
  InventoryImportSourceType,
  InventoryUploadDto,
  InventoryUploadType
} from "@/types/inventory";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const UPLOAD_ROOT = process.env.INVENTORY_UPLOAD_DIR ?? path.join(process.cwd(), "storage", "inventory-uploads");

type ParsedImportRow = {
  name: string;
  unit?: string | null;
  quantity?: number | null;
  unitCostVnd?: number | null;
  totalCostVnd?: number | null;
  purchaseDate?: string | null;
  note?: string | null;
  rawText?: string | null;
};

type ValidatedImportRow = ParsedImportRow & {
  rowIndex: number;
  status: InventoryImportRowStatus;
  errors: string[];
  matchedInventoryItemId: string | null;
};

const geminiRowSchema = z.object({
  rows: z.array(
    z.object({
      name: z.string().trim().min(1),
      unit: z.string().trim().nullable().optional(),
      quantity: z.coerce.number().nullable().optional(),
      unitCostVnd: z.coerce.number().int().nonnegative().nullable().optional(),
      totalCostVnd: z.coerce.number().int().nonnegative().nullable().optional(),
      purchaseDate: z.string().trim().nullable().optional(),
      note: z.string().trim().nullable().optional()
    })
  )
});

type InventoryImportBatchWithRows = Prisma.InventoryImportBatchGetPayload<{
  include: {
    upload: true;
    rows: {
      include: {
        matchedInventoryItem: {
          select: {
            name: true;
          };
        };
      };
      orderBy: {
        rowIndex: "asc";
      };
    };
  };
}>;

export async function saveInventoryUpload({
  file,
  uploadType,
  uploadedById
}: {
  file: File;
  uploadType: InventoryUploadType;
  uploadedById?: string;
}) {
  validateUploadFile(file, uploadType);

  const bytes = Buffer.from(await file.arrayBuffer());
  const storedFileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}-${sanitizeFileName(file.name)}`;
  const storedFilePath = path.join(UPLOAD_ROOT, uploadType.toLowerCase(), storedFileName);
  await mkdir(path.dirname(storedFilePath), { recursive: true });
  await writeFile(storedFilePath, bytes);

  const db = getDb();
  const upload = await db.inventoryUpload.create({
    data: {
      originalFileName: file.name,
      storedFilePath,
      mimeType: file.type || inferMimeType(file.name),
      fileSize: bytes.length,
      uploadType,
      uploadedById: uploadedById ?? null
    }
  });

  return mapUpload(upload);
}

export async function createImportBatchFromUpload({
  uploadId,
  parserPreference = "auto",
  createdById
}: {
  uploadId: string;
  parserPreference?: "auto" | "deterministic" | "gemini";
  createdById?: string;
}): Promise<InventoryImportBatchDto> {
  const db = getDb();
  const upload = await db.inventoryUpload.findUniqueOrThrow({ where: { id: uploadId } });

  if (upload.uploadType !== "IMPORT") {
    throw new InventoryImportError("Only import uploads can be parsed into import batches.");
  }

  const sourceType = getSourceType(upload.originalFileName, upload.mimeType);
  const deterministicRows = await parseUploadDeterministically(upload.storedFilePath, sourceType);
  let parserUsed: InventoryImportParserUsed = "DETERMINISTIC";
  let parsedRows = deterministicRows;

  const shouldUseGemini =
    parserPreference === "gemini" || (parserPreference === "auto" && deterministicRows.filter(hasRequiredImportFields).length === 0);

  if (shouldUseGemini) {
    const geminiRows = await parseUploadWithGemini(upload.storedFilePath, sourceType);
    if (geminiRows.length) {
      parserUsed = deterministicRows.length ? "MIXED" : "GEMINI";
      parsedRows = geminiRows;
    } else if (!parsedRows.length) {
      parserUsed = "GEMINI";
      parsedRows = [
        {
          name: upload.originalFileName,
          rawText: "Parser did not return structured inventory rows. Review the uploaded file and enter the row manually.",
          note: "Gemini/deterministic parser produced no valid structured rows."
        }
      ];
    }
  }

  const existingItems = await db.inventoryItem.findMany({
    select: {
      id: true,
      name: true,
      unit: true
    }
  });
  const validatedRows = validateParsedRows(parsedRows, existingItems);
  const counts = countRows(validatedRows);

  const batch = await db.$transaction(async (tx) => {
    const createdBatch = await tx.inventoryImportBatch.create({
      data: {
        uploadId,
        status: validatedRows.length ? "PARSED" : "FAILED",
        sourceType,
        parserUsed,
        rowCount: validatedRows.length,
        validRowCount: counts.valid,
        invalidRowCount: counts.invalid,
        createdById: createdById ?? null
      }
    });

    if (validatedRows.length) {
      await tx.inventoryImportRow.createMany({
        data: validatedRows.map((row) => ({
          batchId: createdBatch.id,
          rowIndex: row.rowIndex,
          rawText: row.rawText ?? null,
          parsedJson: toJson(row),
          normalizedName: row.name,
          unit: row.unit ?? null,
          quantity: row.quantity == null ? null : toDecimal(row.quantity),
          unitCostVnd: row.unitCostVnd ?? null,
          totalCostVnd: row.totalCostVnd ?? null,
          purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : null,
          validationStatus: row.status,
          validationErrors: row.errors,
          matchedInventoryItemId: row.matchedInventoryItemId
        }))
      });
    }

    await tx.inventoryUpload.update({
      where: { id: uploadId },
      data: { status: validatedRows.length ? "PARSED" : "FAILED" }
    });

    return tx.inventoryImportBatch.findUniqueOrThrow({
      where: { id: createdBatch.id },
      include: importBatchInclude()
    });
  });

  return mapImportBatch(batch);
}

export async function getImportBatch(batchId: string): Promise<InventoryImportBatchDto> {
  const db = getDb();
  const batch = await db.inventoryImportBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: importBatchInclude()
  });

  return mapImportBatch(batch);
}

export async function updateImportRows(batchId: string, input: UpdateImportRowsInput): Promise<InventoryImportBatchDto> {
  const db = getDb();
  const currentRows = await db.inventoryImportRow.findMany({
    where: { batchId },
    include: {
      matchedInventoryItem: {
        select: {
          name: true
        }
      }
    }
  });
  const currentById = new Map(currentRows.map((row) => [row.id, row]));
  const existingItems = await db.inventoryItem.findMany({ select: { id: true, name: true, unit: true } });

  const updatedRows = input.rows.map((patch) => {
    const current = currentById.get(patch.id);
    if (!current) throw new InventoryImportError("Import row does not belong to this batch.");
    if (patch.skip) {
      return {
        id: patch.id,
        status: "SKIPPED" as InventoryImportRowStatus,
        errors: [],
        matchedInventoryItemId: current.matchedInventoryItemId,
        data: {
          normalizedName: current.normalizedName,
          unit: current.unit,
          quantity: current.quantity?.toNumber() ?? null,
          unitCostVnd: current.unitCostVnd,
          totalCostVnd: current.totalCostVnd,
          purchaseDate: current.purchaseDate?.toISOString() ?? null
        }
      };
    }

    const draft: ParsedImportRow = {
      name: patch.normalizedName,
      unit: patch.unit ?? null,
      quantity: patch.quantity ?? null,
      unitCostVnd: patch.unitCostVnd ?? null,
      totalCostVnd: patch.totalCostVnd ?? null,
      purchaseDate: patch.purchaseDate ?? null,
      rawText: current.rawText
    };
    const [validated] = validateParsedRows([draft], existingItems, current.rowIndex);
    return {
      id: patch.id,
      status: validated.status,
      errors: validated.errors,
      matchedInventoryItemId: validated.matchedInventoryItemId,
      data: {
        normalizedName: validated.name,
        unit: validated.unit ?? null,
        quantity: validated.quantity ?? null,
        unitCostVnd: validated.unitCostVnd ?? null,
        totalCostVnd: validated.totalCostVnd ?? null,
        purchaseDate: validated.purchaseDate ?? null
      }
    };
  });

  await db.$transaction(async (tx) => {
    for (const row of updatedRows) {
      await tx.inventoryImportRow.update({
        where: { id: row.id },
        data: {
          parsedJson: toJson(row.data),
          normalizedName: row.data.normalizedName,
          unit: row.data.unit ?? null,
          quantity: row.data.quantity == null ? null : toDecimal(row.data.quantity),
          unitCostVnd: row.data.unitCostVnd ?? null,
          totalCostVnd: row.data.totalCostVnd ?? null,
          purchaseDate: row.data.purchaseDate ? new Date(row.data.purchaseDate) : null,
          validationStatus: row.status,
          validationErrors: row.errors,
          matchedInventoryItemId: row.matchedInventoryItemId
        }
      });
    }

    const rows = await tx.inventoryImportRow.findMany({ where: { batchId } });
    const counts = countPersistedRows(rows);
    await tx.inventoryImportBatch.update({
      where: { id: batchId },
      data: {
        rowCount: rows.length,
        validRowCount: counts.valid,
        invalidRowCount: counts.invalid
      }
    });
  });

  return getImportBatch(batchId);
}

export async function confirmImportBatch(
  batchId: string,
  input: ConfirmImportInput = {},
  context: { createdById?: string } = {}
): Promise<InventoryImportConfirmResultDto> {
  const db = getDb();
  const batch = await db.inventoryImportBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: {
      rows: {
        orderBy: { rowIndex: "asc" }
      },
      upload: true
    }
  });

  if (batch.status === "CONFIRMED") {
    throw new InventoryImportError("Import batch is already confirmed.");
  }

  const allowedRowIds = input.rowIds?.length ? new Set(input.rowIds) : null;
  let createdItemCount = 0;
  let movementCount = 0;
  let skippedRowCount = 0;

  await db.$transaction(async (tx) => {
    for (const row of batch.rows) {
      if (allowedRowIds && !allowedRowIds.has(row.id)) continue;
      if (row.validationStatus === "SKIPPED") {
        skippedRowCount += 1;
        continue;
      }
      if (row.validationStatus === "INVALID") {
        throw new InventoryImportError(`Row ${row.rowIndex} is invalid and cannot be confirmed.`);
      }

      let item =
        row.matchedInventoryItemId &&
        (await tx.inventoryItem.findUnique({
          where: { id: row.matchedInventoryItemId }
        }));

      if (!item) {
        item = await tx.inventoryItem.create({
          data: {
            name: row.normalizedName,
            unit: row.unit ?? "unit",
            currentQuantity: new Prisma.Decimal(0),
            lowStockThreshold: new Prisma.Decimal(0)
          }
        });
        createdItemCount += 1;
      }

      if (row.quantity && row.purchaseDate) {
        const quantityBefore = item.currentQuantity;
        const quantityDelta = row.quantity;
        const quantityAfter = quantityBefore.plus(quantityDelta);
        const totalCostVnd = row.totalCostVnd ?? calculateTotalCost(row.unitCostVnd, quantityDelta);

        const movement = await tx.inventoryStockMovement.create({
          data: {
            inventoryItemId: item.id,
            movementType: "PURCHASE",
            quantityDelta,
            quantityBefore,
            quantityAfter,
            purchaseDate: row.purchaseDate,
            unitCostVnd: row.unitCostVnd,
            totalCostVnd,
            note: `Import batch ${batch.id}`,
            createdById: context.createdById ?? null
          }
        });

        await tx.inventoryPurchaseRecord.create({
          data: {
            inventoryItemId: item.id,
            stockMovementId: movement.id,
            purchaseDate: row.purchaseDate,
            unitCostVnd: row.unitCostVnd,
            totalCostVnd,
            note: `Created from import ${batch.upload.originalFileName}`
          }
        });

        await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            currentQuantity: quantityAfter
          }
        });
        movementCount += 1;
      }

      await tx.inventoryImportRow.update({
        where: { id: row.id },
        data: { validationStatus: "CONFIRMED" }
      });
    }

    await tx.inventoryImportBatch.update({
      where: { id: batchId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date()
      }
    });
  });

  return {
    batch: await getImportBatch(batchId),
    createdItemCount,
    movementCount,
    skippedRowCount
  };
}

export async function attachInvoiceUpload({
  uploadId,
  stockMovementId,
  purchaseRecordId,
  note
}: {
  uploadId: string;
  stockMovementId?: string | null;
  purchaseRecordId?: string | null;
  note?: string | null;
}) {
  if (!stockMovementId && !purchaseRecordId) {
    throw new InventoryImportError("Invoice attachment requires a stock movement or purchase record.");
  }

  const db = getDb();
  const attachment = await db.$transaction(async (tx) => {
    const upload = await tx.inventoryUpload.findUniqueOrThrow({ where: { id: uploadId } });
    if (upload.uploadType !== "INVOICE") {
      throw new InventoryImportError("Only invoice uploads can be attached to purchase records.");
    }

    const created = await tx.inventoryInvoiceAttachment.create({
      data: {
        uploadId,
        stockMovementId: stockMovementId ?? null,
        purchaseRecordId: purchaseRecordId ?? null,
        note: note ?? null
      }
    });

    await tx.inventoryUpload.update({
      where: { id: uploadId },
      data: { status: "ATTACHED" }
    });

    return created;
  });

  return {
    id: attachment.id,
    uploadId: attachment.uploadId,
    stockMovementId: attachment.stockMovementId,
    purchaseRecordId: attachment.purchaseRecordId,
    note: attachment.note,
    createdAt: attachment.createdAt.toISOString()
  };
}

export class InventoryImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryImportError";
  }
}

function validateUploadFile(file: File, uploadType: InventoryUploadType) {
  if (!file.size) throw new InventoryImportError("Uploaded file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new InventoryImportError("Uploaded file exceeds the 8 MB limit.");

  const sourceType = getSourceType(file.name, file.type || inferMimeType(file.name));
  if (uploadType === "IMPORT" && sourceType === "UNKNOWN") {
    throw new InventoryImportError("Import files must be .txt, .csv, .xlsx, or .xls.");
  }
}

function sanitizeFileName(fileName: string) {
  const parsed = path.parse(fileName);
  const base = parsed.name.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
  const ext = parsed.ext.replace(/[^a-zA-Z0-9.]+/g, "").slice(0, 12);
  return `${base.slice(0, 80)}${ext}`;
}

function inferMimeType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  return "application/octet-stream";
}

function getSourceType(fileName: string, mimeType: string): InventoryImportSourceType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".csv") || mimeType.includes("text/")) return "TXT";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "EXCEL";
  return "UNKNOWN";
}

async function parseUploadDeterministically(filePath: string, sourceType: InventoryImportSourceType): Promise<ParsedImportRow[]> {
  if (sourceType === "EXCEL") {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const rows: ParsedImportRow[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });
      for (const row of sheetRows) {
        rows.push(parseRecordObject(row));
      }
    }
    return rows.filter((row) => row.name);
  }

  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseTextLine)
    .filter((row) => row.name);
}

function parseRecordObject(record: Record<string, unknown>): ParsedImportRow {
  const get = (...keys: string[]) => {
    const foundKey = Object.keys(record).find((key) => keys.some((candidate) => normalizeKey(key) === normalizeKey(candidate)));
    return foundKey ? record[foundKey] : undefined;
  };
  const quantity = parseNumberValue(get("quantity", "qty", "so luong", "số lượng", "sl"));
  const unitCostVnd = parseMoneyValue(get("unit cost", "unitCost", "don gia", "đơn giá"));
  const totalCostVnd = parseMoneyValue(get("total cost", "total", "thanh tien", "thành tiền"));

  return {
    name: stringValue(get("name", "ingredient", "material", "ten", "tên", "nguyen lieu", "nguyên liệu")),
    unit: stringValue(get("unit", "don vi", "đơn vị")),
    quantity,
    unitCostVnd,
    totalCostVnd,
    purchaseDate: normalizeDate(get("purchase date", "date", "ngay mua", "ngày mua")),
    note: stringValue(get("note", "ghi chu", "ghi chú"))
  };
}

function parseTextLine(line: string): ParsedImportRow {
  const delimiter = line.includes("\t") ? "\t" : line.includes("|") ? "|" : line.includes(",") ? "," : "";
  if (!delimiter) {
    return { name: line, rawText: line };
  }

  const cells = line.split(delimiter).map((cell) => cell.trim());
  return {
    name: cells[0] ?? "",
    unit: cells[1] || null,
    quantity: parseNumberValue(cells[2]),
    unitCostVnd: parseMoneyValue(cells[3]),
    totalCostVnd: parseMoneyValue(cells[4]),
    purchaseDate: normalizeDate(cells[5]),
    rawText: line
  };
}

async function parseUploadWithGemini(filePath: string, sourceType: InventoryImportSourceType): Promise<ParsedImportRow[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
  const sourceText = sourceType === "EXCEL" ? excelToText(filePath) : await readFile(filePath, "utf8");
  const prompt = [
    "Extract coffee shop inventory ingredient or purchase rows from this uploaded file.",
    "Return strict JSON only with this shape:",
    '{"rows":[{"name":"string","unit":"kg|g|ml|liter|pack|box|piece|bottle|can or source unit","quantity":number|null,"unitCostVnd":integer|null,"totalCostVnd":integer|null,"purchaseDate":"YYYY-MM-DD or null","note":"string|null"}]}',
    "Money must be integer VND. Do not include markdown.",
    sourceText.slice(0, 12000)
  ].join("\n\n");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    console.info("[inventory-import] Gemini parser failed", await response.text());
    return [];
  }

  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const rawText = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const parsed = geminiRowSchema.safeParse(JSON.parse(stripJsonFence(rawText)));
  if (!parsed.success) {
    console.info("[inventory-import] Gemini output validation failed", parsed.error.flatten());
    return [];
  }

  return parsed.data.rows.map((row) => ({
    name: row.name,
    unit: row.unit ?? null,
    quantity: row.quantity ?? null,
    unitCostVnd: row.unitCostVnd ?? null,
    totalCostVnd: row.totalCostVnd ?? null,
    purchaseDate: normalizeDate(row.purchaseDate ?? undefined),
    note: row.note ?? null
  }));
}

function excelToText(filePath: string) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  return workbook.SheetNames.map((sheetName) => {
    const rows = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
    return `Sheet: ${sheetName}\n${rows}`;
  }).join("\n\n");
}

function validateParsedRows(
  rows: ParsedImportRow[],
  existingItems: Array<{ id: string; name: string; unit: string }>,
  startIndex = 1
): ValidatedImportRow[] {
  const seenNames = new Set<string>();
  return rows.map((row, offset) => {
    const errors: string[] = [];
    const normalizedName = row.name.trim();
    const normalizedUnit = row.unit?.trim() || null;
    const matched = existingItems.find((item) => normalizeName(item.name) === normalizeName(normalizedName)) ?? null;
    const nameKey = normalizeName(normalizedName);

    if (!normalizedName) errors.push("Ingredient name is required.");
    if (!normalizedUnit) errors.push("Unit is required.");
    if (row.quantity != null && row.quantity <= 0) errors.push("Quantity must be greater than zero when provided.");
    if (row.quantity != null && !row.purchaseDate) errors.push("Purchase date is required when quantity is provided.");
    if (row.unitCostVnd != null && !Number.isInteger(row.unitCostVnd)) errors.push("Unit cost must be integer VND.");
    if (row.totalCostVnd != null && !Number.isInteger(row.totalCostVnd)) errors.push("Total cost must be integer VND.");
    if (seenNames.has(nameKey)) errors.push("Duplicate ingredient name in this import.");
    if (matched && normalizedUnit && normalizeName(matched.unit) !== normalizeName(normalizedUnit)) {
      errors.push(`Matched existing ingredient uses unit ${matched.unit}.`);
    }
    seenNames.add(nameKey);

    let status: InventoryImportRowStatus = errors.length ? "INVALID" : "VALID";
    if (!errors.length && matched) status = "WARNING";

    return {
      ...row,
      name: normalizedName,
      unit: normalizedUnit,
      rowIndex: startIndex + offset,
      status,
      errors,
      matchedInventoryItemId: matched?.id ?? null
    };
  });
}

function hasRequiredImportFields(row: ParsedImportRow) {
  return Boolean(row.name && row.unit);
}

function countRows(rows: ValidatedImportRow[]) {
  return rows.reduce(
    (counts, row) => {
      if (row.status === "INVALID") counts.invalid += 1;
      if (row.status === "VALID" || row.status === "WARNING") counts.valid += 1;
      return counts;
    },
    { valid: 0, invalid: 0 }
  );
}

function countPersistedRows(rows: Array<{ validationStatus: InventoryImportRowStatus }>) {
  return rows.reduce(
    (counts, row) => {
      if (row.validationStatus === "INVALID") counts.invalid += 1;
      if (row.validationStatus === "VALID" || row.validationStatus === "WARNING") counts.valid += 1;
      return counts;
    },
    { valid: 0, invalid: 0 }
  );
}

function mapImportBatch(batch: InventoryImportBatchWithRows): InventoryImportBatchDto {
  return {
    id: batch.id,
    uploadId: batch.uploadId,
    upload: mapUpload(batch.upload),
    status: batch.status,
    sourceType: batch.sourceType,
    parserUsed: batch.parserUsed,
    rowCount: batch.rowCount,
    validRowCount: batch.validRowCount,
    invalidRowCount: batch.invalidRowCount,
    createdAt: batch.createdAt.toISOString(),
    confirmedAt: batch.confirmedAt?.toISOString() ?? null,
    rows: batch.rows.map(mapImportRow)
  };
}

function mapImportRow(row: InventoryImportBatchWithRows["rows"][number]): InventoryImportRowDto {
  return {
    id: row.id,
    batchId: row.batchId,
    rowIndex: row.rowIndex,
    rawText: row.rawText,
    parsedJson: row.parsedJson as Record<string, unknown>,
    normalizedName: row.normalizedName,
    unit: row.unit,
    quantity: row.quantity?.toNumber() ?? null,
    unitCostVnd: toNullableNumber(row.unitCostVnd),
    totalCostVnd: toNullableNumber(row.totalCostVnd),
    purchaseDate: row.purchaseDate?.toISOString() ?? null,
    validationStatus: row.validationStatus,
    validationErrors: Array.isArray(row.validationErrors) ? (row.validationErrors as string[]) : [],
    matchedInventoryItemId: row.matchedInventoryItemId,
    matchedInventoryItemName: row.matchedInventoryItem?.name ?? null,
    createdAt: row.createdAt.toISOString()
  };
}

function mapUpload(upload: {
  id: string;
  originalFileName: string;
  storedFilePath: string;
  mimeType: string;
  fileSize: number;
  uploadType: InventoryUploadType;
  status: "STORED" | "PARSED" | "ATTACHED" | "FAILED";
  createdAt: Date;
}): InventoryUploadDto {
  return {
    id: upload.id,
    originalFileName: upload.originalFileName,
    storedFilePath: upload.storedFilePath,
    mimeType: upload.mimeType,
    fileSize: upload.fileSize,
    uploadType: upload.uploadType,
    status: upload.status,
    createdAt: upload.createdAt.toISOString()
  };
}

function importBatchInclude() {
  return {
    upload: true,
    rows: {
      include: {
        matchedInventoryItem: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        rowIndex: "asc" as const
      }
    }
  };
}

function toDecimal(value: number) {
  return new Prisma.Decimal(value.toString());
}

function calculateTotalCost(unitCostVnd: bigint | number | null, quantityDelta: Prisma.Decimal) {
  if (unitCostVnd === null) return null;
  return BigInt(Math.round(toNumber(unitCostVnd) * quantityDelta.abs().toNumber()));
}

function toNullableNumber(value: bigint | number | null) {
  if (value === null) return null;
  return toNumber(value);
}

function toNumber(value: bigint | number) {
  return typeof value === "bigint" ? Number(value) : value;
}

function normalizeKey(value: string) {
  return normalizeName(value).replace(/[^a-z0-9]+/g, "");
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function stringValue(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}

function parseNumberValue(value: unknown): number | null {
  const text = stringValue(value).replace(/\s/g, "").replace(",", ".");
  if (!text) return null;
  const parsed = Number(text.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMoneyValue(value: unknown): number | null {
  const parsed = parseNumberValue(value);
  return parsed == null ? null : Math.round(parsed);
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const text = stringValue(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString();
}

function stripJsonFence(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
