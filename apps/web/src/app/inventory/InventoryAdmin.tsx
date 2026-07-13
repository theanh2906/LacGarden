"use client";

import {
  AlertTriangle,
  BarChart3,
  Calculator,
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  Home,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  TrendingDown,
  Upload
} from "lucide-react";
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { StyledSelect } from "@/components/ui/StyledSelect";
import type {
  InventoryAdminSnapshot,
  InventoryImportBatchDto,
  InventoryImportConfirmResultDto,
  InventoryItemDto,
  InventoryStatusFilter,
  InventoryStockMovementDto,
  InventoryStockMovementType,
  InventorySummaryDto
} from "@/types/inventory";
import styles from "./InventoryAdmin.module.scss";

type InventoryAdminProps = {
  initialSnapshot: InventoryAdminSnapshot;
};

type ItemFormState = {
  name: string;
  code: string;
  unit: string;
  currentQuantity: string;
  lowStockThreshold: string;
  note: string;
};

type MovementFormState = {
  movementType: InventoryStockMovementType;
  quantity: string;
  quantityDelta: string;
  finalQuantity: string;
  purchaseDate: string;
  unitCostVnd: string;
  totalCostVnd: string;
  note: string;
};

type InventoryOperation =
  | "refresh"
  | "select"
  | "createItem"
  | "updateItem"
  | "toggleItem"
  | "createMovement"
  | "parseImport"
  | "saveImport"
  | "confirmImport"
  | "uploadInvoice";

const statusFilters: Array<{ value: InventoryStatusFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "active", label: "Đang dùng" },
  { value: "low-stock", label: "Sắp hết" },
  { value: "out-of-stock", label: "Hết hàng" },
  { value: "inactive", label: "Ngưng dùng" }
];

const movementTypes: Array<{ value: InventoryStockMovementType; label: string }> = [
  { value: "PURCHASE", label: "Nhập mua" },
  { value: "ADJUSTMENT", label: "Điều chỉnh" },
  { value: "WASTE", label: "Hao hụt" },
  { value: "CORRECTION", label: "Kiểm kho" }
];

const operationLabels: Record<InventoryOperation, string> = {
  refresh: "Đang làm mới dữ liệu kho...",
  select: "Đang tải lịch sử nguyên liệu...",
  createItem: "Đang lưu nguyên liệu...",
  updateItem: "Đang cập nhật nguyên liệu...",
  toggleItem: "Đang đổi trạng thái nguyên liệu...",
  createMovement: "Đang ghi biến động kho...",
  parseImport: "Đang tải lên và phân tích tệp...",
  saveImport: "Đang lưu chỉnh sửa nhập dữ liệu...",
  confirmImport: "Đang xác nhận nhập dữ liệu...",
  uploadInvoice: "Đang tải lên hoá đơn..."
};

const defaultItemForm: ItemFormState = {
  name: "",
  code: "",
  unit: "kg",
  currentQuantity: "0",
  lowStockThreshold: "0",
  note: ""
};

const defaultMovementForm: MovementFormState = {
  movementType: "PURCHASE",
  quantity: "",
  quantityDelta: "",
  finalQuantity: "",
  purchaseDate: new Date().toISOString().slice(0, 10),
  unitCostVnd: "",
  totalCostVnd: "",
  note: ""
};

export function InventoryAdmin({ initialSnapshot }: InventoryAdminProps) {
  const importFileInputId = useId();
  const invoiceFileInputId = useId();
  const [items, setItems] = useState(initialSnapshot.items);
  const [recentMovements, setRecentMovements] = useState(initialSnapshot.recentMovements);
  const [selectedItemId, setSelectedItemId] = useState(initialSnapshot.items[0]?.id ?? "");
  const [selectedMovements, setSelectedMovements] = useState<InventoryStockMovementDto[]>([]);
  const [statusFilter, setStatusFilter] = useState<InventoryStatusFilter>("all");
  const [query, setQuery] = useState("");
  const [itemForm, setItemForm] = useState(defaultItemForm);
  const [editForm, setEditForm] = useState<ItemFormState>(() => toItemForm(initialSnapshot.items[0]));
  const [movementForm, setMovementForm] = useState(defaultMovementForm);
  const [notice, setNotice] = useState("Kho hàng đã sẵn sàng để nhập liệu quản trị.");
  const [pendingOperation, setPendingOperation] = useState<InventoryOperation | null>(null);
  const [importBatch, setImportBatch] = useState<InventoryImportBatchDto | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceMovementId, setInvoiceMovementId] = useState("");

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;
  const isSubmitting = pendingOperation !== null;
  const loadingMessage = pendingOperation ? operationLabels[pendingOperation] : null;
  const summary = useMemo(() => calculateSummary(items), [items]);
  const purchaseMovements = useMemo(() => {
    const movementById = new Map<string, InventoryStockMovementDto>();
    for (const movement of [...recentMovements, ...selectedMovements]) {
      if (movement.movementType === "PURCHASE") movementById.set(movement.id, movement);
    }
    return Array.from(movementById.values());
  }, [recentMovements, selectedMovements]);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const statusMatch = matchesStatus(item, statusFilter);
      const text = `${item.name} ${item.code ?? ""} ${item.unit} ${item.note ?? ""}`.toLowerCase();
      return statusMatch && (!normalizedQuery || text.includes(normalizedQuery));
    });
  }, [items, query, statusFilter]);

  async function selectItem(item: InventoryItemDto) {
    setSelectedItemId(item.id);
    setEditForm(toItemForm(item));
    setNotice(`Đang xem lịch sử kho của ${item.name}`);
    setPendingOperation("select");
    try {
      const response = await fetch(`/api/inventory/items/${item.id}/movements`);
      const payload = (await response.json()) as { data?: InventoryStockMovementDto[]; error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Không tải được lịch sử kho.");
      setSelectedMovements(payload.data ?? []);
    } catch (error) {
      logInventoryAdminError("Failed to load stock movement history", error);
    } finally {
      setPendingOperation(null);
    }
  }

  async function refreshItems(status: InventoryStatusFilter = statusFilter, showLoading = false) {
    if (showLoading) setPendingOperation("refresh");
    try {
      const response = await fetch(`/api/inventory/items?status=${status}`);
      const payload = (await response.json()) as { data?: InventoryItemDto[]; error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Không tải được danh sách kho.");
      setItems(payload.data ?? []);
      if (showLoading) setNotice("Đã làm mới danh sách kho.");
    } finally {
      if (showLoading) setPendingOperation(null);
    }
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingOperation("createItem");
    try {
      const response = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: itemForm.name,
          code: itemForm.code,
          unit: itemForm.unit,
          currentQuantity: parseNumber(itemForm.currentQuantity),
          lowStockThreshold: parseNumber(itemForm.lowStockThreshold),
          note: itemForm.note
        })
      });
      const payload = (await response.json()) as { data?: InventoryItemDto; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không tạo được nguyên liệu.");
      const createdItem = payload.data;
      setItems((current) => upsertItem(current, createdItem));
      setItemForm(defaultItemForm);
      await selectItem(createdItem);
      setNotice(`Đã tạo nguyên liệu ${createdItem.name}`);
    } catch (error) {
      logInventoryAdminError("Failed to create inventory item", error);
    } finally {
      setPendingOperation(null);
    }
  }

  async function updateSelectedItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedItem) return;
    setPendingOperation("updateItem");
    try {
      const response = await fetch(`/api/inventory/items/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          code: editForm.code,
          unit: editForm.unit,
          lowStockThreshold: parseNumber(editForm.lowStockThreshold),
          note: editForm.note
        })
      });
      const payload = (await response.json()) as { data?: InventoryItemDto; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không cập nhật được nguyên liệu.");
      const updatedItem = payload.data;
      setItems((current) => upsertItem(current, updatedItem));
      setNotice(`Đã cập nhật ${updatedItem.name}`);
    } catch (error) {
      logInventoryAdminError("Failed to update inventory item", error);
    } finally {
      setPendingOperation(null);
    }
  }

  async function toggleSelectedItem() {
    if (!selectedItem) return;
    setPendingOperation("toggleItem");
    try {
      const response = await fetch(`/api/inventory/items/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !selectedItem.isActive })
      });
      const payload = (await response.json()) as { data?: InventoryItemDto; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không đổi được trạng thái.");
      const updatedItem = payload.data;
      setItems((current) => upsertItem(current, updatedItem));
      setNotice(updatedItem.isActive ? "Đã kích hoạt lại nguyên liệu." : "Đã ngưng dùng nguyên liệu.");
    } catch (error) {
      logInventoryAdminError("Failed to toggle inventory item", error);
    } finally {
      setPendingOperation(null);
    }
  }

  async function createMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedItem) return;
    setPendingOperation("createMovement");
    try {
      const payloadBody = buildMovementPayload(selectedItem.id, movementForm);
      const response = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody)
      });
      const payload = (await response.json()) as {
        data?: { item: InventoryItemDto; movement: InventoryStockMovementDto };
        error?: { message: string };
      };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không ghi được biến động kho.");
      const movementResult = payload.data;
      setItems((current) => upsertItem(current, movementResult.item));
      setRecentMovements((current) => [movementResult.movement, ...current].slice(0, 12));
      setSelectedMovements((current) => [movementResult.movement, ...current]);
      setMovementForm(defaultMovementForm);
      setNotice(`Đã ghi ${movementLabel(movementResult.movement.movementType)} cho ${movementResult.item.name}`);
    } catch (error) {
      logInventoryAdminError("Failed to create stock movement", error);
    } finally {
      setPendingOperation(null);
    }
  }

  async function uploadAndParseImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importFile) return;
    setPendingOperation("parseImport");
    try {
      const formData = new FormData();
      formData.set("file", importFile);
      formData.set("uploadType", "IMPORT");
      formData.set("parse", "true");
      formData.set("parser", "auto");
      const response = await fetch("/api/inventory/uploads", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as { data?: { batch?: InventoryImportBatchDto | null }; error?: { message: string } };
      if (!response.ok || !payload.data?.batch) throw new Error(payload.error?.message ?? "Không thể phân tích tệp nhập.");
      setImportBatch(payload.data.batch);
      setNotice(`Đã parse ${payload.data.batch.rowCount} dòng từ ${payload.data.batch.upload.originalFileName}`);
    } catch (error) {
      logInventoryAdminError("Failed to upload and parse inventory import", error);
    } finally {
      setPendingOperation(null);
    }
  }

  async function saveImportCorrections() {
    if (!importBatch) return;
    setPendingOperation("saveImport");
    try {
      const response = await fetch(`/api/inventory/imports/${importBatch.id}/rows`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: importBatch.rows.map((row) => ({
            id: row.id,
            normalizedName: row.normalizedName,
            unit: row.unit,
            quantity: row.quantity,
            unitCostVnd: row.unitCostVnd,
            totalCostVnd: row.totalCostVnd,
            purchaseDate: row.purchaseDate,
            skip: row.validationStatus === "SKIPPED"
          }))
        })
      });
      const payload = (await response.json()) as { data?: InventoryImportBatchDto; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không thể cập nhật dòng nhập.");
      setImportBatch(payload.data);
      setNotice(`Đã lưu chỉnh sửa import: ${payload.data.validRowCount} dòng hợp lệ`);
    } catch (error) {
      logInventoryAdminError("Failed to save import corrections", error);
    } finally {
      setPendingOperation(null);
    }
  }

  async function confirmImport() {
    if (!importBatch) return;
    setPendingOperation("confirmImport");
    try {
      const response = await fetch(`/api/inventory/imports/${importBatch.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const payload = (await response.json()) as { data?: InventoryImportConfirmResultDto; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không thể xác nhận nhập dữ liệu.");
      setImportBatch(payload.data.batch);
      await refreshItems().catch((error) => logInventoryAdminError("Failed to refresh after import confirmation", error));
      setNotice(`Đã confirm import: tạo ${payload.data.createdItemCount} nguyên liệu, ${payload.data.movementCount} movement`);
    } catch (error) {
      logInventoryAdminError("Failed to confirm import", error);
    } finally {
      setPendingOperation(null);
    }
  }

  async function uploadInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoiceFile) return;
    setPendingOperation("uploadInvoice");
    try {
      const formData = new FormData();
      formData.set("file", invoiceFile);
      formData.set("uploadType", "INVOICE");
      const response = await fetch("/api/inventory/uploads", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as { data?: { upload: { id: string; originalFileName: string } }; error?: { message: string } };
      if (!response.ok || !payload.data?.upload) throw new Error(payload.error?.message ?? "Không thể tải lên hoá đơn.");

      if (invoiceMovementId) {
        const attachResponse = await fetch(`/api/inventory/uploads/${payload.data.upload.id}/invoice-attachments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stockMovementId: invoiceMovementId })
        });
        const attachPayload = (await attachResponse.json()) as { error?: { message: string } };
        if (!attachResponse.ok) throw new Error(attachPayload.error?.message ?? "Không thể đính kèm hoá đơn.");
      }

      setInvoiceFile(null);
      setInvoiceMovementId("");
      setNotice(invoiceMovementId ? "Đã tải lên và đính kèm hoá đơn vào phiếu nhập mua" : "Đã tải lên hoá đơn để đối soát");
    } catch (error) {
      logInventoryAdminError("Failed to upload invoice", error);
    } finally {
      setPendingOperation(null);
    }
  }

  function updateImportRow(rowId: string, patch: Partial<InventoryImportBatchDto["rows"][number]>) {
    setImportBatch((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
          }
        : current
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Lac Garden POS</span>
          <h1>Quản lý kho</h1>
          <p>Desktop admin cho nguyên liệu, tồn kho và lịch sử nhập/xuất.</p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.secondaryButton} href="/">
            <Home size={17} /> Home
          </a>
          <a className={styles.secondaryButton} href="/inventory/reports">
            <BarChart3 size={17} /> Reports
          </a>
          <a className={styles.secondaryButton} href="/inventory/costing">
            <Calculator size={17} /> Costing
          </a>
          <button className={styles.secondaryButton} type="button" onClick={() => refreshItems(statusFilter, true).catch((error) => logInventoryAdminError("Failed to refresh inventory items", error))} disabled={isSubmitting}>
            <ButtonContent loading={pendingOperation === "refresh"} icon={<RefreshCw size={17} />} label="Làm mới" loadingLabel="Đang tải..." />
          </button>
        </div>
      </header>

      <section className={styles.notice} role="status">
        {loadingMessage ? <Loader2 className={styles.spinnerIcon} size={18} /> : <Package size={18} />}
        <span>{loadingMessage ?? notice}</span>
      </section>

      <section className={styles.metrics} aria-label="Tổng quan kho">
        <Metric label="Nguyên liệu" value={summary.totalItems.toString()} />
        <Metric label="Đang dùng" value={summary.activeItems.toString()} />
        <Metric label="Sắp hết" value={summary.lowStockItems.toString()} tone="warn" />
        <Metric label="Hết hàng" value={summary.outOfStockItems.toString()} tone="danger" />
      </section>

      <section className={styles.importGrid}>
        <form className={styles.card} onSubmit={uploadAndParseImport}>
          <div className={styles.panelTitle}>
            <Upload size={18} />
            <strong>Import Excel/TXT</strong>
          </div>
          <div className={styles.uploadFormRow}>
            <label className={`${styles.filePicker} ${importFile ? styles.filePickerActive : ""}`} htmlFor={importFileInputId}>
              <span className={styles.filePickerIcon}>
                <Upload size={18} />
              </span>
              <span className={styles.filePickerText}>
                <strong>{importFile ? importFile.name : "Chọn tệp nhập dữ liệu"}</strong>
                <small>{importFile ? formatFileSize(importFile.size) : "Excel, TXT hoặc CSV"}</small>
              </span>
              <span className={styles.filePickerAction}>Chọn tệp</span>
            </label>
            <input
              className={styles.hiddenFileInput}
              id={importFileInputId}
              type="file"
              accept=".txt,.csv,.xlsx,.xls"
              disabled={isSubmitting}
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
            />
            <button className={styles.primaryButton} type="submit" disabled={isSubmitting || !importFile}>
              <ButtonContent loading={pendingOperation === "parseImport"} label="Phân tích tệp" loadingLabel="Đang phân tích..." />
            </button>
          </div>
          <small className={styles.helperText}>
            TXT/CSV dùng cột: tên, unit, quantity, unitCost, totalCost, purchaseDate. Excel đọc header tương đương; Gemini chỉ chạy server-side khi parser thường không đủ.
          </small>
        </form>

        <form className={styles.card} onSubmit={uploadInvoice}>
          <div className={styles.panelTitle}>
            <FileText size={18} />
            <strong>Upload hóa đơn</strong>
          </div>
          <div className={`${styles.uploadFormRow} ${styles.invoiceUploadRow}`}>
            <label className={`${styles.filePicker} ${invoiceFile ? styles.filePickerActive : ""}`} htmlFor={invoiceFileInputId}>
              <span className={styles.filePickerIcon}>
                <FileText size={18} />
              </span>
              <span className={styles.filePickerText}>
                <strong>{invoiceFile ? invoiceFile.name : "Chọn tệp hoá đơn"}</strong>
                <small>{invoiceFile ? formatFileSize(invoiceFile.size) : "PDF, ảnh hoặc file scan"}</small>
              </span>
              <span className={styles.filePickerAction}>Chọn tệp</span>
            </label>
            <input
              className={styles.hiddenFileInput}
              id={invoiceFileInputId}
              type="file"
              disabled={isSubmitting}
              onChange={(event) => setInvoiceFile(event.target.files?.[0] ?? null)}
            />
            <StyledSelect
              className={styles.uploadSelect}
              value={invoiceMovementId}
              onValueChange={setInvoiceMovementId}
              disabled={isSubmitting}
              options={[{ value: "", label: "Chỉ lưu file" }, ...purchaseMovements.map((movement) => ({
                value: movement.id,
                label: `${movement.itemName} · ${formatNumber(movement.quantityDelta)} · ${movement.purchaseDate ? dateInputValue(movement.purchaseDate) : "no date"}`
              }))]}
            />
            <button className={styles.primaryButton} type="submit" disabled={isSubmitting || !invoiceFile}>
              <ButtonContent loading={pendingOperation === "uploadInvoice"} label="Tải lên" loadingLabel="Đang tải lên..." />
            </button>
          </div>
          <small className={styles.helperText}>File hóa đơn lưu trên filesystem local và metadata giữ trong database để reconciliation.</small>
        </form>
      </section>

      {importBatch ? (
        <section className={styles.importReview}>
          <div className={styles.reviewHeader}>
            <div>
              <div className={styles.panelTitle}>
                <CheckCircle2 size={18} />
                <strong>Review import: {importBatch.upload.originalFileName}</strong>
              </div>
              <small>
                Parser {importBatch.parserUsed} · {importBatch.validRowCount} valid · {importBatch.invalidRowCount} invalid
              </small>
            </div>
            <div className={styles.actionRow}>
              <button className={styles.secondaryButton} type="button" onClick={saveImportCorrections} disabled={isSubmitting}>
                <ButtonContent loading={pendingOperation === "saveImport"} label="Lưu chỉnh sửa" loadingLabel="Đang lưu..." />
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={confirmImport}
                disabled={isSubmitting || importBatch.invalidRowCount > 0 || importBatch.status === "CONFIRMED"}
              >
                <ButtonContent loading={pendingOperation === "confirmImport"} label="Xác nhận nhập" loadingLabel="Đang xác nhận..." />
              </button>
            </div>
          </div>
          <div className={styles.importTable}>
            <div className={styles.importHeader}>
              <span>#</span>
              <span>Tên</span>
              <span>Đơn vị</span>
              <span>Số lượng</span>
              <span>Đơn giá</span>
              <span>Tổng tiền</span>
              <span>Ngày mua</span>
              <span>Trạng thái</span>
            </div>
            {importBatch.rows.map((row) => (
              <div className={styles.importRow} key={row.id}>
                <span>{row.rowIndex}</span>
                <input value={row.normalizedName} onChange={(event) => updateImportRow(row.id, { normalizedName: event.target.value })} />
                <input value={row.unit ?? ""} onChange={(event) => updateImportRow(row.id, { unit: event.target.value || null })} />
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={row.quantity ?? ""}
                  onChange={(event) => updateImportRow(row.id, { quantity: parseOptionalNumber(event.target.value) })}
                />
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={row.unitCostVnd ?? ""}
                  onChange={(event) => updateImportRow(row.id, { unitCostVnd: parseOptionalInteger(event.target.value) ?? null })}
                />
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={row.totalCostVnd ?? ""}
                  onChange={(event) => updateImportRow(row.id, { totalCostVnd: parseOptionalInteger(event.target.value) ?? null })}
                />
                <input
                  type="date"
                  value={dateInputValue(row.purchaseDate)}
                  onChange={(event) => updateImportRow(row.id, { purchaseDate: event.target.value ? toIsoDate(event.target.value) : null })}
                />
                <span className={`${styles.badge} ${row.validationStatus === "INVALID" ? styles.badge_OUT_OF_STOCK : styles.badge_OK}`}>
                  {importRowStatusLabel(row.validationStatus)}
                </span>
                {row.validationErrors.length ? <p className={styles.rowError}>{row.validationErrors.join("; ")}</p> : null}
                {row.matchedInventoryItemName ? <p className={styles.rowWarning}>Khớp với: {row.matchedInventoryItemName}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.workbench}>
        <div className={styles.inventoryPane}>
          <div className={styles.toolbar}>
            <label className={styles.searchBox}>
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, mã, đơn vị" />
            </label>
            <div className={styles.filterTabs} aria-label="Lọc tồn kho">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={statusFilter === filter.value ? styles.activeFilter : undefined}
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Nguyên liệu</span>
              <span>Tồn</span>
              <span>Ngưỡng</span>
              <span>Trạng thái</span>
            </div>
            {filteredItems.map((item) => (
              <button
                className={`${styles.tableRow} ${selectedItem?.id === item.id ? styles.selectedRow : ""}`}
                key={item.id}
                type="button"
                disabled={isSubmitting}
                onClick={() => selectItem(item)}
              >
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.code ?? "Chưa có mã"} · {item.unit}</small>
                </span>
                <strong>{formatQuantity(item.currentQuantity, item.unit)}</strong>
                <span>{formatQuantity(item.lowStockThreshold, item.unit)}</span>
                <StatusBadge item={item} />
              </button>
            ))}
            {!filteredItems.length ? <p className={styles.emptyState}>Chưa có nguyên liệu phù hợp bộ lọc.</p> : null}
          </div>

          <form className={styles.createPanel} onSubmit={createItem}>
            <div className={styles.panelTitle}>
              <Plus size={18} />
              <strong>Thêm nguyên liệu</strong>
            </div>
            <div className={styles.formGrid}>
              <Field label="Tên">
                <input required value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} />
              </Field>
              <Field label="Mã">
                <input value={itemForm.code} onChange={(event) => setItemForm({ ...itemForm, code: event.target.value })} />
              </Field>
              <Field label="Đơn vị">
                <input required value={itemForm.unit} onChange={(event) => setItemForm({ ...itemForm, unit: event.target.value })} />
              </Field>
              <Field label="Tồn đầu">
                <input
                  required
                  type="number"
                  step="0.001"
                  min="0"
                  value={itemForm.currentQuantity}
                  onChange={(event) => setItemForm({ ...itemForm, currentQuantity: event.target.value })}
                />
              </Field>
              <Field label="Ngưỡng thấp">
                <input
                  required
                  type="number"
                  step="0.001"
                  min="0"
                  value={itemForm.lowStockThreshold}
                  onChange={(event) => setItemForm({ ...itemForm, lowStockThreshold: event.target.value })}
                />
              </Field>
              <Field label="Ghi chú">
                <input value={itemForm.note} onChange={(event) => setItemForm({ ...itemForm, note: event.target.value })} />
              </Field>
            </div>
            <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
              <ButtonContent loading={pendingOperation === "createItem"} icon={<Save size={17} />} label="Lưu nguyên liệu" loadingLabel="Đang lưu..." />
            </button>
          </form>
        </div>

        <aside className={styles.detailPane}>
          {selectedItem ? (
            <>
              <section className={styles.card}>
                <div className={styles.panelTitle}>
                  <ClipboardList size={18} />
                  <strong>Chi tiết nguyên liệu</strong>
                </div>
                <form onSubmit={updateSelectedItem}>
                  <div className={styles.formGrid}>
                    <Field label="Tên">
                      <input required value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
                    </Field>
                    <Field label="Mã">
                      <input value={editForm.code} onChange={(event) => setEditForm({ ...editForm, code: event.target.value })} />
                    </Field>
                    <Field label="Đơn vị">
                      <input required value={editForm.unit} onChange={(event) => setEditForm({ ...editForm, unit: event.target.value })} />
                    </Field>
                    <Field label="Tồn hiện tại">
                      <input value={formatQuantity(selectedItem.currentQuantity, selectedItem.unit)} disabled />
                    </Field>
                    <Field label="Ngưỡng thấp">
                      <input
                        required
                        type="number"
                        step="0.001"
                        min="0"
                        value={editForm.lowStockThreshold}
                        onChange={(event) => setEditForm({ ...editForm, lowStockThreshold: event.target.value })}
                      />
                    </Field>
                    <Field label="Ghi chú">
                      <input value={editForm.note} onChange={(event) => setEditForm({ ...editForm, note: event.target.value })} />
                    </Field>
                  </div>
                  <div className={styles.actionRow}>
                    <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
                      <ButtonContent loading={pendingOperation === "updateItem"} icon={<Save size={17} />} label="Cập nhật" loadingLabel="Đang cập nhật..." />
                    </button>
                    <button className={styles.secondaryButton} type="button" onClick={toggleSelectedItem} disabled={isSubmitting}>
                      <ButtonContent
                        loading={pendingOperation === "toggleItem"}
                        label={selectedItem.isActive ? "Ngưng dùng" : "Kích hoạt"}
                        loadingLabel="Đang đổi..."
                      />
                    </button>
                  </div>
                </form>
              </section>

              <section className={styles.card}>
                <div className={styles.panelTitle}>
                  <TrendingDown size={18} />
                  <strong>Ghi biến động kho</strong>
                </div>
                <form onSubmit={createMovement}>
                  <div className={styles.formGrid}>
                    <Field label="Loại">
                      <StyledSelect
                        value={movementForm.movementType}
                        onValueChange={(value) => setMovementForm({ ...movementForm, movementType: value as InventoryStockMovementType })}
                        options={movementTypes}
                      />
                    </Field>
                    {movementForm.movementType === "CORRECTION" ? (
                      <Field label="Tồn kiểm thực tế">
                        <input
                          required
                          type="number"
                          step="0.001"
                          min="0"
                          value={movementForm.finalQuantity}
                          onChange={(event) => setMovementForm({ ...movementForm, finalQuantity: event.target.value })}
                        />
                      </Field>
                    ) : movementForm.movementType === "ADJUSTMENT" ? (
                      <Field label="Chênh lệch (+/-)">
                        <input
                          required
                          type="number"
                          step="0.001"
                          value={movementForm.quantityDelta}
                          onChange={(event) => setMovementForm({ ...movementForm, quantityDelta: event.target.value })}
                        />
                      </Field>
                    ) : (
                      <Field label="Số lượng">
                        <input
                          required
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={movementForm.quantity}
                          onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })}
                        />
                      </Field>
                    )}
                    {movementForm.movementType === "PURCHASE" ? (
                      <>
                        <Field label="Ngày mua">
                          <input
                            required
                            type="date"
                            value={movementForm.purchaseDate}
                            onChange={(event) => setMovementForm({ ...movementForm, purchaseDate: event.target.value })}
                          />
                        </Field>
                        <Field label="Đơn giá VND">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={movementForm.unitCostVnd}
                            onChange={(event) => setMovementForm({ ...movementForm, unitCostVnd: event.target.value })}
                          />
                        </Field>
                        <Field label="Tổng VND">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={movementForm.totalCostVnd}
                            onChange={(event) => setMovementForm({ ...movementForm, totalCostVnd: event.target.value })}
                          />
                        </Field>
                      </>
                    ) : null}
                    <Field label="Ghi chú">
                      <input value={movementForm.note} onChange={(event) => setMovementForm({ ...movementForm, note: event.target.value })} />
                    </Field>
                  </div>
                  <button className={`${styles.primaryButton} ${styles.formSubmitButton}`} type="submit" disabled={isSubmitting || !selectedItem.isActive}>
                    <ButtonContent loading={pendingOperation === "createMovement"} icon={<Plus size={17} />} label="Ghi biến động" loadingLabel="Đang ghi..." />
                  </button>
                </form>
              </section>

              <section className={styles.card}>
                <div className={styles.panelTitle}>
                  <History size={18} />
                  <strong>Lịch sử của {selectedItem.name}</strong>
                </div>
                <MovementList movements={selectedMovements.length ? selectedMovements : recentMovements.filter((m) => m.inventoryItemId === selectedItem.id)} />
              </section>
            </>
          ) : (
            <section className={styles.card}>
              <AlertTriangle size={22} />
              <strong>Chưa có nguyên liệu</strong>
              <p>Tạo nguyên liệu đầu tiên để bắt đầu quản lý tồn kho.</p>
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  return (
    <article className={`${styles.metric} ${tone === "warn" ? styles.warnMetric : ""} ${tone === "danger" ? styles.dangerMetric : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ButtonContent({
  loading,
  icon,
  label,
  loadingLabel
}: {
  loading: boolean;
  icon?: ReactNode;
  label: string;
  loadingLabel: string;
}) {
  return (
    <>
      {loading ? <Loader2 className={styles.spinnerIcon} size={17} /> : icon}
      {loading ? loadingLabel : label}
    </>
  );
}

function StatusBadge({ item }: { item: InventoryItemDto }) {
  const label = {
    OK: "Ổn",
    LOW_STOCK: "Sắp hết",
    OUT_OF_STOCK: "Hết hàng",
    INACTIVE: "Ngưng dùng"
  }[item.alertState];

  return <span className={`${styles.badge} ${styles[`badge_${item.alertState}`]}`}>{label}</span>;
}

function MovementList({ movements }: { movements: InventoryStockMovementDto[] }) {
  if (!movements.length) {
    return <p className={styles.emptyState}>Chưa có lịch sử biến động cho nguyên liệu này.</p>;
  }

  return (
    <div className={styles.movementList}>
      {movements.map((movement) => (
        <article className={styles.movementRow} key={movement.id}>
          <div>
            <strong>{movementLabel(movement.movementType)}</strong>
            <small>{new Date(movement.createdAt).toLocaleString("vi-VN")}</small>
          </div>
          <span className={movement.quantityDelta < 0 ? styles.negativeQty : styles.positiveQty}>
            {movement.quantityDelta > 0 ? "+" : ""}
            {formatNumber(movement.quantityDelta)}
          </span>
          <small>
            {formatNumber(movement.quantityBefore)} → {formatNumber(movement.quantityAfter)}
          </small>
          {movement.totalCostVnd ? <strong>{formatVnd(movement.totalCostVnd)}</strong> : <span>{movement.note ?? ""}</span>}
        </article>
      ))}
    </div>
  );
}

function calculateSummary(items: InventoryItemDto[]): InventorySummaryDto {
  return items.reduce<InventorySummaryDto>(
    (summary, item) => {
      summary.totalItems += 1;
      if (item.isActive) summary.activeItems += 1;
      if (!item.isActive) summary.inactiveItems += 1;
      if (item.alertState === "LOW_STOCK") summary.lowStockItems += 1;
      if (item.alertState === "OUT_OF_STOCK") summary.outOfStockItems += 1;
      return summary;
    },
    {
      totalItems: 0,
      activeItems: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      inactiveItems: 0,
      stockValueVnd: 0
    }
  );
}

function matchesStatus(item: InventoryItemDto, status: InventoryStatusFilter) {
  if (status === "all") return true;
  if (status === "active") return item.isActive;
  if (status === "inactive") return !item.isActive;
  if (status === "low-stock") return item.alertState === "LOW_STOCK";
  if (status === "out-of-stock") return item.alertState === "OUT_OF_STOCK";
  return true;
}

function toItemForm(item?: InventoryItemDto | null): ItemFormState {
  if (!item) return defaultItemForm;
  return {
    name: item.name,
    code: item.code ?? "",
    unit: item.unit,
    currentQuantity: item.currentQuantity.toString(),
    lowStockThreshold: item.lowStockThreshold.toString(),
    note: item.note ?? ""
  };
}

function upsertItem(items: InventoryItemDto[], item: InventoryItemDto) {
  const found = items.some((current) => current.id === item.id);
  if (!found) return [item, ...items].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
  return items.map((current) => (current.id === item.id ? item : current));
}

function buildMovementPayload(inventoryItemId: string, form: MovementFormState) {
  const base = {
    inventoryItemId,
    movementType: form.movementType,
    note: form.note
  };

  if (form.movementType === "PURCHASE") {
    return {
      ...base,
      quantity: parseNumber(form.quantity),
      purchaseDate: toIsoDate(form.purchaseDate),
      unitCostVnd: parseOptionalInteger(form.unitCostVnd),
      totalCostVnd: parseOptionalInteger(form.totalCostVnd)
    };
  }

  if (form.movementType === "WASTE") {
    return {
      ...base,
      quantity: parseNumber(form.quantity)
    };
  }

  if (form.movementType === "CORRECTION") {
    return {
      ...base,
      finalQuantity: parseNumber(form.finalQuantity)
    };
  }

  return {
    ...base,
    quantityDelta: parseNumber(form.quantityDelta)
  };
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOptionalInteger(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function dateInputValue(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function movementLabel(type: InventoryStockMovementType) {
  const labels: Record<InventoryStockMovementType, string> = {
    PURCHASE: "Nhập mua",
    ADJUSTMENT: "Điều chỉnh",
    WASTE: "Hao hụt",
    CORRECTION: "Kiểm kho"
  };
  return labels[type];
}

function importRowStatusLabel(status: string) {
  const labels: Record<string, string> = {
    VALID: "Hợp lệ",
    INVALID: "Không hợp lệ",
    WARNING: "Cần xem xét",
    CONFIRMED: "Đã xác nhận",
    SKIPPED: "Đã bỏ qua"
  };
  return labels[status] ?? status;
}

function formatQuantity(quantity: number, unit: string) {
  return `${formatNumber(quantity)} ${unit}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 3
  }).format(value);
}

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / 1024 / 102.4) / 10} MB`;
}

function logInventoryAdminError(message: string, error: unknown) {
  console.info(`[inventory-admin] ${message}`, error);
}
