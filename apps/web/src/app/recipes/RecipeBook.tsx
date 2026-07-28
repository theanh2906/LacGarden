"use client";

import {
  ArrowLeft,
  BookOpen,
  ChefHat,
  ChevronDown,
  Home,
  Loader2,
  PackagePlus,
  PencilLine,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Utensils
} from "lucide-react";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { formatVnd } from "@/lib/money";
import type {
  ProductCostingAdminSnapshot,
  ProductCostTargetDto,
  ProductRecipeTargetType
} from "@/types/costing";
import styles from "./RecipeBook.module.scss";

type RecipeBookProps = {
  initialSnapshot: ProductCostingAdminSnapshot;
  canEditRecipes: boolean;
};

type IngredientFormRow = {
  clientId: string;
  inventoryItemId: string;
  quantity: string;
  unit: string;
  wastePercent: string;
};

type PendingOperation = "refresh" | "saveRecipe";

const operationLabels: Record<PendingOperation, string> = {
  refresh: "Đang làm mới sổ công thức...",
  saveRecipe: "Đang lưu công thức..."
};

export function RecipeBook({ initialSnapshot, canEditRecipes }: RecipeBookProps) {
  const pageTopRef = useRef<HTMLElement>(null);
  const initialRecipeTargets = getRecipeTargets(initialSnapshot.targets);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedKey, setSelectedKey] = useState(() => targetKey(initialRecipeTargets[0]));
  const [editMode, setEditMode] = useState(false);
  const [packagingCostVnd, setPackagingCostVnd] = useState(() => initialRecipeTargets[0]?.recipe?.packagingCostVnd.toString() ?? "0");
  const [note, setNote] = useState(() => initialRecipeTargets[0]?.recipe?.note ?? "");
  const [ingredientRows, setIngredientRows] = useState<IngredientFormRow[]>(() => toIngredientRows(initialRecipeTargets[0]));
  const [isMixPanelOpen, setIsMixPanelOpen] = useState(false);
  const [notice, setNotice] = useState("Sổ công thức đã sẵn sàng.");
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);

  const recipeTargets = useMemo(() => getRecipeTargets(snapshot.targets), [snapshot.targets]);
  const selectedTarget = useMemo(
    () => recipeTargets.find((target) => targetKey(target) === selectedKey) ?? recipeTargets[0] ?? null,
    [selectedKey, recipeTargets]
  );
  const categories = useMemo(() => getCategories(recipeTargets), [recipeTargets]);
  const activeInventoryItems = snapshot.inventoryItems.filter((item) => item.isActive);
  const isSubmitting = pendingOperation !== null;
  const loadingMessage = pendingOperation ? operationLabels[pendingOperation] : null;

  const filteredTargets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return recipeTargets.filter((target) => {
      const categoryMatch = category === "all" || target.categoryName === category;
      const text = `${target.label} ${target.recipe?.note ?? ""} ${target.recipe?.ingredients.map((item) => item.inventoryItemName).join(" ")}`.toLowerCase();
      return categoryMatch && (!normalizedQuery || text.includes(normalizedQuery));
    });
  }, [category, query, recipeTargets]);

  function selectTarget(target: ProductCostTargetDto) {
    setSelectedKey(targetKey(target));
    setPackagingCostVnd((target.recipe?.packagingCostVnd ?? 0).toString());
    setNote(target.recipe?.note ?? "");
    setIngredientRows(toIngredientRows(target));
    setEditMode(false);
    setIsMixPanelOpen(false);
    setNotice(`Đang xem công thức ${target.label}`);
    scrollRecipeIntoView(pageTopRef.current);
  }

  async function refreshSnapshot(showNotice = true) {
    setPendingOperation("refresh");
    try {
      const response = await fetch("/api/recipes");
      const payload = (await response.json()) as { data?: ProductCostingAdminSnapshot; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Không tải được công thức.");
      setSnapshot(payload.data);
      const refreshedTargets = getRecipeTargets(payload.data.targets);
      const refreshedTarget = refreshedTargets.find((target) => targetKey(target) === selectedKey) ?? refreshedTargets[0] ?? null;
      if (refreshedTarget) {
        setSelectedKey(targetKey(refreshedTarget));
        setPackagingCostVnd((refreshedTarget.recipe?.packagingCostVnd ?? 0).toString());
        setNote(refreshedTarget.recipe?.note ?? "");
        setIngredientRows(toIngredientRows(refreshedTarget));
      }
      if (showNotice) setNotice("Đã làm mới sổ công thức.");
    } catch (error) {
      console.info("[recipe-book] Refresh failed", error);
    } finally {
      setPendingOperation(null);
    }
  }

  async function saveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTarget || !canEditRecipes) return;
    setPendingOperation("saveRecipe");
    try {
      const response = await fetch("/api/recipes", {
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
      setEditMode(false);
      setNotice(`Đã lưu công thức ${selectedTarget.label}`);
    } catch (error) {
      console.info("[recipe-book] Save recipe failed", error);
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

  const readyCount = recipeTargets.filter((target) => target.cost.recipeSource !== "none").length;
  const missingCount = recipeTargets.length - readyCount;

  return (
    <main className={styles.page} ref={pageTopRef}>
      <header className={styles.appHeader}>
        <a className={styles.backLink} href="/">
          <ArrowLeft size={18} /> POS
        </a>
        <div>
          <span className={styles.eyebrow}>Lac Garden</span>
          <h1>Công thức pha chế</h1>
          <p>Xem nhanh định lượng khi đứng quầy, chỉnh liều lượng và nguyên liệu khi cần.</p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.iconButton} href="/admin" aria-label="Về trang module">
            <Home size={18} />
          </a>
          <button className={styles.iconButton} type="button" onClick={() => refreshSnapshot().catch(() => undefined)} disabled={isSubmitting} aria-label="Làm mới">
            {pendingOperation === "refresh" ? <Loader2 className={styles.spinnerIcon} size={18} /> : <RefreshCw size={18} />}
          </button>
        </div>
      </header>

      <section className={styles.mobileStatus} role="status">
        {loadingMessage ? <Loader2 className={styles.spinnerIcon} size={16} /> : <BookOpen size={16} />}
        <span>{loadingMessage ?? notice}</span>
      </section>

      <section className={styles.metrics} aria-label="Tổng quan công thức">
        <Metric label="Món menu" value={recipeTargets.length.toString()} />
        <Metric label="Đã có công thức" value={readyCount.toString()} />
        <Metric label="Cần bổ sung" value={missingCount.toString()} tone={missingCount ? "warn" : undefined} />
      </section>

      <section className={styles.controls}>
        <label className={styles.searchBox}>
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm món hoặc nguyên liệu" />
        </label>
        <div className={styles.categoryTabs} aria-label="Lọc nhóm món">
          <button type="button" className={category === "all" ? styles.activeTab : undefined} onClick={() => setCategory("all")}>
            Tất cả
          </button>
          {categories.map((item) => (
            <button key={item} type="button" className={category === item ? styles.activeTab : undefined} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.recipeList} aria-label="Danh sách công thức">
          {filteredTargets.map((target) => (
            <button
              className={`${styles.recipeCard} ${selectedTarget && targetKey(target) === targetKey(selectedTarget) ? styles.selectedCard : ""}`}
              key={targetKey(target)}
              type="button"
              disabled={isSubmitting}
              onClick={() => selectTarget(target)}
            >
              <span className={styles.recipeIcon}>
                <ChefHat size={20} />
              </span>
              <span className={styles.recipeTitle}>
                <strong>{cleanTargetLabel(target.label)}</strong>
                <small>{target.recipe?.ingredients.length ?? 0} nguyên liệu · {formatVnd(target.salePriceVnd)}</small>
              </span>
              <RecipeStateBadge target={target} />
            </button>
          ))}
          {!filteredTargets.length ? <p className={styles.emptyState}>Chưa có công thức phù hợp.</p> : null}
        </aside>

        <section className={styles.detailPane}>
          {selectedTarget ? (
            <>
              <article className={styles.recipeHero}>
                <span className={styles.heroIcon}>
                  <Utensils size={24} />
                </span>
                <div>
                  <span>{selectedTarget.categoryName}</span>
                  <h2>{cleanTargetLabel(selectedTarget.label)}</h2>
                  <p>{selectedTarget.recipe?.note || "Chưa có ghi chú pha chế cho món này."}</p>
                </div>
                {canEditRecipes ? (
                  <button className={styles.editButton} type="button" onClick={() => setEditMode((current) => !current)} disabled={isSubmitting}>
                    <PencilLine size={17} />
                    {editMode ? "Đóng chỉnh sửa" : "Chỉnh"}
                  </button>
                ) : null}
              </article>

              <section className={styles.mixPanel}>
                <button
                  className={styles.panelToggle}
                  type="button"
                  aria-expanded={isMixPanelOpen}
                  onClick={() => setIsMixPanelOpen((current) => !current)}
                >
                  <span>
                    <BookOpen size={18} />
                    <strong>Định lượng 1 ly</strong>
                  </span>
                  <span className={`${styles.panelToggleIcon} ${isMixPanelOpen ? styles.panelToggleOpen : ""}`}>
                    <ChevronDown size={18} />
                  </span>
                </button>
                {isMixPanelOpen ? (
                  <div className={styles.ingredientReadList}>
                    {selectedTarget.recipe?.ingredients.map((ingredient, index) => (
                      <div className={styles.readIngredient} key={ingredient.id}>
                        <span>{index + 1}</span>
                        <strong>{ingredient.inventoryItemName}</strong>
                        <b>{formatQuantity(ingredient.quantity, ingredient.unit)}</b>
                      </div>
                    ))}
                    {!selectedTarget.recipe?.ingredients.length ? <p className={styles.emptyState}>Chưa có nguyên liệu. Mở chỉnh sửa để thêm định lượng.</p> : null}
                  </div>
                ) : null}
              </section>

              {editMode && canEditRecipes ? (
                <form className={styles.editPanel} onSubmit={saveRecipe}>
                  <div className={styles.panelTitle}>
                    <PencilLine size={18} />
                    <strong>Chỉnh công thức</strong>
                  </div>

                  <div className={styles.editGrid}>
                    <Field label="Bao bì VND">
                      <input required type="number" min="0" step="1" value={packagingCostVnd} onChange={(event) => setPackagingCostVnd(event.target.value)} />
                    </Field>
                    <Field label="Ghi chú / cách pha">
                      <textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
                    </Field>
                  </div>

                  <div className={styles.ingredientsHeader}>
                    <strong>Nguyên liệu</strong>
                    <button className={styles.secondaryButton} type="button" onClick={addIngredientRow} disabled={isSubmitting || !activeInventoryItems.length}>
                      <Plus size={16} /> Thêm
                    </button>
                  </div>

                  <div className={styles.ingredientEditList}>
                    {ingredientRows.map((row) => (
                      <div className={styles.ingredientEditRow} key={row.clientId}>
                        <Field label="Nguyên liệu">
                          <StyledSelect
                            required
                            value={row.inventoryItemId}
                            onValueChange={(value) => updateIngredientRow(row.clientId, { inventoryItemId: value })}
                            options={activeInventoryItems.map((item) => ({
                              value: item.id,
                              label: `${item.name} · ${item.unit}`
                            }))}
                          />
                        </Field>
                        <Field label="SL">
                          <input required type="number" min="0.001" step="0.001" value={row.quantity} onChange={(event) => updateIngredientRow(row.clientId, { quantity: event.target.value })} />
                        </Field>
                        <Field label="Đơn vị">
                          <input required value={row.unit} onChange={(event) => updateIngredientRow(row.clientId, { unit: event.target.value })} />
                        </Field>
                        <Field label="Hao hụt %">
                          <input required type="number" min="0" max="100" step="0.01" value={row.wastePercent} onChange={(event) => updateIngredientRow(row.clientId, { wastePercent: event.target.value })} />
                        </Field>
                        <button className={styles.deleteButton} type="button" aria-label="Xóa nguyên liệu" onClick={() => setIngredientRows((current) => current.filter((item) => item.clientId !== row.clientId))}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
                    <ButtonContent loading={pendingOperation === "saveRecipe"} icon={<Save size={17} />} label="Lưu công thức" loadingLabel="Đang lưu..." />
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <section className={styles.mixPanel}>
              <p className={styles.emptyState}>Chưa có món menu để hiển thị công thức.</p>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <article className={`${styles.metric} ${tone === "warn" ? styles.warnMetric : ""}`}>
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

function RecipeStateBadge({ target }: { target: ProductCostTargetDto }) {
  if (target.cost.recipeSource === "none") return <span className={styles.missingBadge}>Thiếu</span>;
  if (target.cost.missingCostIngredientCount) return <span className={styles.warnBadge}>Thiếu giá</span>;
  return <span className={styles.readyBadge}>Sẵn sàng</span>;
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

function getRecipeTargets(targets: ProductCostTargetDto[]) {
  return targets.filter((target) => target.targetType === "MENU_ITEM" || target.recipe?.targetType === "MENU_VARIANT");
}

function getCategories(targets: ProductCostTargetDto[]) {
  return Array.from(new Set(targets.map((target) => target.categoryName).filter(Boolean)));
}

function cleanTargetLabel(label: string) {
  return label.replace(" · Base", "");
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

function formatQuantity(quantity: number, unit: string) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(quantity)} ${unit}`;
}

function scrollRecipeIntoView(pageTop: HTMLElement | null) {
  if (!pageTop || !window.matchMedia("(max-width: 980px)").matches) return;
  window.requestAnimationFrame(() => {
    pageTop.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
}
