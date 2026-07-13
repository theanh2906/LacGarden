"use client";

import { AlertTriangle, Calculator, Home, Loader2, PackagePlus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { StyledSelect } from "@/components/ui/StyledSelect";
import type {
  ProductCostingAdminSnapshot,
  ProductCostTargetDto,
  ProductRecipeTargetType
} from "@/types/costing";
import styles from "./ProductCostingAdmin.module.scss";

type ProductCostingAdminProps = {
  initialSnapshot: ProductCostingAdminSnapshot;
};

type IngredientFormRow = {
  clientId: string;
  inventoryItemId: string;
  quantity: string;
  unit: string;
  wastePercent: string;
};

type PendingOperation = "refresh" | "saveRecipe" | "saveRule";

const operationLabels: Record<PendingOperation, string> = {
  refresh: "Đang làm mới giá vốn...",
  saveRecipe: "Đang lưu công thức/BOM...",
  saveRule: "Đang cập nhật ngưỡng lợi nhuận..."
};

export function ProductCostingAdmin({ initialSnapshot }: ProductCostingAdminProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedKey, setSelectedKey] = useState(() => targetKey(initialSnapshot.targets[0]));
  const [packagingCostVnd, setPackagingCostVnd] = useState(() => initialSnapshot.targets[0]?.recipe?.packagingCostVnd.toString() ?? "0");
  const [note, setNote] = useState(() => initialSnapshot.targets[0]?.recipe?.note ?? "");
  const [ingredientRows, setIngredientRows] = useState<IngredientFormRow[]>(() => toIngredientRows(initialSnapshot.targets[0]));
  const [thresholdPercent, setThresholdPercent] = useState(initialSnapshot.marginRule.thresholdPercent.toString());
  const [notice, setNotice] = useState("Giá vốn sản phẩm sẵn sàng.");
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);

  const selectedTarget = useMemo(
    () => snapshot.targets.find((target) => targetKey(target) === selectedKey) ?? snapshot.targets[0] ?? null,
    [selectedKey, snapshot.targets]
  );
  const activeInventoryItems = snapshot.inventoryItems.filter((item) => item.isActive);
  const isSubmitting = pendingOperation !== null;
  const loadingMessage = pendingOperation ? operationLabels[pendingOperation] : null;

  function selectTarget(target: ProductCostTargetDto) {
    setSelectedKey(targetKey(target));
    setPackagingCostVnd((target.recipe?.packagingCostVnd ?? 0).toString());
    setNote(target.recipe?.note ?? "");
    setIngredientRows(toIngredientRows(target));
    setNotice(`Đang chỉnh ${target.label}`);
  }

  async function refreshSnapshot(showNotice = true) {
    setPendingOperation("refresh");
    try {
      const response = await fetch("/api/inventory/product-costing");
      const payload = (await response.json()) as { data?: ProductCostingAdminSnapshot; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không tải được giá vốn.");
      setSnapshot(payload.data);
      const refreshedTarget = payload.data.targets.find((target) => targetKey(target) === selectedKey) ?? payload.data.targets[0] ?? null;
      if (refreshedTarget) {
        setSelectedKey(targetKey(refreshedTarget));
        setPackagingCostVnd((refreshedTarget.recipe?.packagingCostVnd ?? 0).toString());
        setNote(refreshedTarget.recipe?.note ?? "");
        setIngredientRows(toIngredientRows(refreshedTarget));
      }
      setThresholdPercent(payload.data.marginRule.thresholdPercent.toString());
      if (showNotice) setNotice("Đã làm mới giá vốn.");
    } catch (error) {
      console.info("[product-costing-admin] Refresh failed", error);
      setNotice(error instanceof Error ? error.message : "Không tải được giá vốn.");
    } finally {
      setPendingOperation(null);
    }
  }

  async function saveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTarget) return;
    setPendingOperation("saveRecipe");
    try {
      const response = await fetch("/api/inventory/product-costing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: selectedTarget.targetType,
          targetId: selectedTarget.targetId,
          packagingCostVnd: parseInteger(packagingCostVnd),
          note,
          ingredients: ingredientRows
            .filter((row) => row.inventoryItemId)
            .map((row) => ({
              inventoryItemId: row.inventoryItemId,
              quantity: parseNumber(row.quantity),
              unit: row.unit,
              wastePercent: parseNumber(row.wastePercent)
            }))
        })
      });
      const payload = (await response.json()) as { data?: ProductCostingAdminSnapshot; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không lưu được công thức.");
      setSnapshot(payload.data);
      const updatedTarget = payload.data.targets.find((target) => target.targetType === selectedTarget.targetType && target.targetId === selectedTarget.targetId);
      if (updatedTarget) {
        setSelectedKey(targetKey(updatedTarget));
        setPackagingCostVnd((updatedTarget.recipe?.packagingCostVnd ?? 0).toString());
        setNote(updatedTarget.recipe?.note ?? "");
        setIngredientRows(toIngredientRows(updatedTarget));
      }
      setNotice(`Đã lưu công thức cho ${selectedTarget.label}`);
    } catch (error) {
      console.info("[product-costing-admin] Save recipe failed", error);
      setNotice(error instanceof Error ? error.message : "Không lưu được công thức.");
    } finally {
      setPendingOperation(null);
    }
  }

  async function saveMarginRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingOperation("saveRule");
    try {
      const response = await fetch("/api/inventory/product-costing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thresholdPercent: parseNumber(thresholdPercent) })
      });
      const payload = (await response.json()) as { data?: ProductCostingAdminSnapshot; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không lưu được ngưỡng lợi nhuận.");
      setSnapshot(payload.data);
      setThresholdPercent(payload.data.marginRule.thresholdPercent.toString());
      setNotice(`Đã cập nhật cảnh báo lợi nhuận dưới ${payload.data.marginRule.thresholdPercent}%`);
    } catch (error) {
      console.info("[product-costing-admin] Save margin rule failed", error);
      setNotice(error instanceof Error ? error.message : "Không lưu được ngưỡng lợi nhuận.");
    } finally {
      setPendingOperation(null);
    }
  }

  function addIngredientRow() {
    const item = activeInventoryItems[0];
    setIngredientRows((current) => [
      ...current,
      {
        clientId: crypto.randomUUID(),
        inventoryItemId: item?.id ?? "",
        quantity: "1",
        unit: item?.unit ?? "",
        wastePercent: "0"
      }
    ]);
  }

  function updateIngredientRow(clientId: string, patch: Partial<IngredientFormRow>) {
    setIngredientRows((current) =>
      current.map((row) => {
        if (row.clientId !== clientId) return row;
        const next = { ...row, ...patch };
        if (patch.inventoryItemId) {
          const item = snapshot.inventoryItems.find((inventoryItem) => inventoryItem.id === patch.inventoryItemId);
          if (item) next.unit = item.unit;
        }
        return next;
      })
    );
  }

  const lowMarginCount = snapshot.targets.filter((target) => target.cost.isLowMargin).length;
  const missingRecipeCount = snapshot.targets.filter((target) => target.cost.recipeSource === "none").length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Lac Garden POS</span>
          <h1>Giá vốn sản phẩm</h1>
          <p>Công thức/BOM, chi phí bao bì, biên lợi nhuận gộp và cảnh báo lợi nhuận thấp.</p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.secondaryButton} href="/">
            <Home size={17} /> Home
          </a>
          <a className={styles.secondaryButton} href="/inventory">
            <PackagePlus size={17} /> Inventory
          </a>
          <button className={styles.secondaryButton} type="button" onClick={() => refreshSnapshot().catch(() => undefined)} disabled={isSubmitting}>
            <ButtonContent loading={pendingOperation === "refresh"} icon={<RefreshCw size={17} />} label="Làm mới" loadingLabel="Đang tải..." />
          </button>
        </div>
      </header>

      <section className={styles.notice} role="status">
        {loadingMessage ? <Loader2 className={styles.spinnerIcon} size={18} /> : <Calculator size={18} />}
        <span>{loadingMessage ?? notice}</span>
      </section>

      <section className={styles.metrics}>
        <Metric label="Sản phẩm/biến thể" value={snapshot.targets.length.toString()} />
        <Metric label="Lợi nhuận thấp" value={lowMarginCount.toString()} tone={lowMarginCount ? "danger" : undefined} />
        <Metric label="Thiếu công thức" value={missingRecipeCount.toString()} tone={missingRecipeCount ? "warn" : undefined} />
        <Metric label="Ngưỡng cảnh báo" value={`${snapshot.marginRule.thresholdPercent}%`} />
      </section>

      <section className={styles.workbench}>
        <div className={styles.targetPane}>
          <div className={styles.toolbar}>
            <strong>Giá vốn menu</strong>
            <span>{snapshot.targets.length} targets</span>
          </div>
          <div className={styles.targetList}>
            {snapshot.targets.map((target) => (
              <button
                className={`${styles.targetRow} ${selectedTarget && targetKey(target) === targetKey(selectedTarget) ? styles.selectedRow : ""}`}
                key={targetKey(target)}
                type="button"
                disabled={isSubmitting}
                onClick={() => selectTarget(target)}
              >
                <span>
                  <strong>{target.label}</strong>
                  <small>{target.targetType === "MENU_ITEM" ? "Món menu" : "Biến thể"} · {formatVnd(target.salePriceVnd)}</small>
                </span>
                <span className={styles.targetNumbers}>
                  <b>{formatVnd(target.cost.totalCostVnd)}</b>
                  <MarginBadge target={target} />
                </span>
              </button>
            ))}
            {!snapshot.targets.length ? <p className={styles.emptyState}>Chưa có món menu để thiết lập giá vốn.</p> : null}
          </div>
        </div>

        <aside className={styles.detailPane}>
          <form className={styles.card} onSubmit={saveMarginRule}>
            <div className={styles.panelTitle}>
              <AlertTriangle size={18} />
              <strong>Quy tắc lợi nhuận thấp</strong>
            </div>
            <div className={styles.ruleRow}>
              <label className={styles.field}>
                <span>Cảnh báo dưới %</span>
                <input
                  required
                  type="number"
                  min="0"
                  max="95"
                  step="0.01"
                  value={thresholdPercent}
                  onChange={(event) => setThresholdPercent(event.target.value)}
                />
              </label>
              <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
                <ButtonContent loading={pendingOperation === "saveRule"} icon={<Save size={17} />} label="Lưu quy tắc" loadingLabel="Đang lưu..." />
              </button>
            </div>
          </form>

          {selectedTarget ? (
            <form className={styles.card} onSubmit={saveRecipe}>
              <div className={styles.panelTitle}>
                <Calculator size={18} />
                <strong>{selectedTarget.label}</strong>
              </div>

              <div className={styles.costSummary}>
                <CostCell label="Giá bán" value={formatVnd(selectedTarget.salePriceVnd)} />
                <CostCell label="Nguyên liệu" value={formatVnd(selectedTarget.cost.ingredientCostVnd)} />
                <CostCell label="Bao bì" value={formatVnd(selectedTarget.cost.packagingCostVnd)} />
                <CostCell label="Biên lợi nhuận" value={`${selectedTarget.cost.grossMarginPercent}%`} tone={selectedTarget.cost.isLowMargin ? "danger" : undefined} />
              </div>

              {selectedTarget.cost.recipeSource === "item-fallback" ? (
                <p className={styles.warningText}>Biến thể này đang kế thừa công thức cấp món menu. Lưu biểu mẫu để tạo thiết lập riêng.</p>
              ) : null}
              {selectedTarget.cost.missingCostIngredientCount ? (
                <p className={styles.warningText}>{selectedTarget.cost.missingCostIngredientCount} nguyên liệu chưa có đơn giá nhập mua.</p>
              ) : null}

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Chi phí bao bì (VND)</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={packagingCostVnd}
                    onChange={(event) => setPackagingCostVnd(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Ghi chú</span>
                  <input value={note} onChange={(event) => setNote(event.target.value)} />
                </label>
              </div>

              <div className={styles.ingredientsHeader}>
                <strong>Nguyên liệu</strong>
                <button className={styles.secondaryButton} type="button" onClick={addIngredientRow} disabled={isSubmitting || !activeInventoryItems.length}>
                  <PackagePlus size={16} /> Thêm dòng
                </button>
              </div>

              <div className={styles.ingredientList}>
                {ingredientRows.map((row) => (
                  <div className={styles.ingredientRow} key={row.clientId}>
                    <label className={styles.field}>
                      <span>Nguyên liệu</span>
                      <StyledSelect
                        required
                        value={row.inventoryItemId}
                        onValueChange={(value) => updateIngredientRow(row.clientId, { inventoryItemId: value })}
                        options={activeInventoryItems.map((item) => ({
                          value: item.id,
                          label: `${item.name} · ${item.unit} · ${formatNullableVnd(item.latestUnitCostVnd)}`
                        }))}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Số lượng</span>
                      <input
                        required
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={row.quantity}
                        onChange={(event) => updateIngredientRow(row.clientId, { quantity: event.target.value })}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Đơn vị</span>
                      <input required value={row.unit} onChange={(event) => updateIngredientRow(row.clientId, { unit: event.target.value })} />
                    </label>
                    <label className={styles.field}>
                      <span>Hao hụt %</span>
                      <input
                        required
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={row.wastePercent}
                        onChange={(event) => updateIngredientRow(row.clientId, { wastePercent: event.target.value })}
                      />
                    </label>
                    <button
                      className={styles.iconDangerButton}
                      type="button"
                      aria-label="Xóa nguyên liệu"
                      onClick={() => setIngredientRows((current) => current.filter((item) => item.clientId !== row.clientId))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {!ingredientRows.length ? <p className={styles.emptyState}>Chưa có nguyên liệu. Thêm dòng để bắt đầu BOM.</p> : null}
              </div>

              <button className={styles.primaryButton} type="submit" disabled={isSubmitting || !selectedTarget}>
                <ButtonContent loading={pendingOperation === "saveRecipe"} icon={<Save size={17} />} label="Lưu công thức/BOM" loadingLabel="Đang lưu..." />
              </button>
            </form>
          ) : (
            <section className={styles.card}>
              <p className={styles.emptyState}>Không có sản phẩm khả dụng.</p>
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

function CostCell({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className={`${styles.costCell} ${tone === "danger" ? styles.dangerCell : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MarginBadge({ target }: { target: ProductCostTargetDto }) {
  const label = target.cost.recipeSource === "none" ? "Chưa có công thức" : target.cost.isLowMargin ? "Lợi nhuận thấp" : `${target.cost.grossMarginPercent}%`;
  return (
    <small className={`${styles.marginBadge} ${target.cost.isLowMargin ? styles.lowMarginBadge : ""} ${target.cost.recipeSource === "none" ? styles.noRecipeBadge : ""}`}>
      {label}
    </small>
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

function toIngredientRows(target?: ProductCostTargetDto | null): IngredientFormRow[] {
  return (
    target?.recipe?.ingredients.map((ingredient) => ({
      clientId: ingredient.id,
      inventoryItemId: ingredient.inventoryItemId,
      quantity: ingredient.quantity.toString(),
      unit: ingredient.unit,
      wastePercent: ingredient.wastePercent.toString()
    })) ?? []
  );
}

function targetKey(target?: { targetType: ProductRecipeTargetType; targetId: string } | null) {
  return target ? `${target.targetType}:${target.targetId}` : "";
}

function parseInteger(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNullableVnd(amount: number | null) {
  return amount === null ? "chưa có giá vốn" : formatVnd(amount);
}

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(amount);
}
