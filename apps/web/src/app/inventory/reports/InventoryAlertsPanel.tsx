"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { InventoryStockOverviewRowDto } from "@/types/inventory";
import styles from "./InventoryReports.module.scss";

type InventoryAlertsPanelProps = {
  lowStockItems: InventoryStockOverviewRowDto[];
  outOfStockItems: InventoryStockOverviewRowDto[];
  staleStockItems: InventoryStockOverviewRowDto[];
};

const storageKey = "coffee-pos.inventory.acknowledged-alerts";

export function InventoryAlertsPanel({ lowStockItems, outOfStockItems, staleStockItems }: InventoryAlertsPanelProps) {
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setAcknowledgedIds(JSON.parse(raw) as string[]);
    } catch (error) {
      console.info("[inventory-admin] Failed to load acknowledged inventory alerts", error);
    }
  }, []);

  const alerts = useMemo(() => {
    const rows = [
      ...outOfStockItems.map((item) => ({ item, tone: "danger" as const, label: "Hết hàng" })),
      ...lowStockItems.map((item) => ({ item, tone: "warn" as const, label: "Sắp hết" })),
      ...staleStockItems.map((item) => ({ item, tone: "muted" as const, label: "Ít biến động" }))
    ];
    const uniqueByItem = new Map(rows.map((row) => [row.item.id, row]));
    return Array.from(uniqueByItem.values()).filter((row) => !acknowledgedIds.includes(row.item.id));
  }, [acknowledgedIds, lowStockItems, outOfStockItems, staleStockItems]);

  function acknowledge(id: string) {
    setAcknowledgedIds((current) => {
      const next = Array.from(new Set([...current, id]));
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  if (!alerts.length) {
    return (
      <section className={styles.alertPanel}>
        <div className={styles.panelTitle}>
          <CheckCircle2 size={18} />
          <strong>Cảnh báo tồn kho</strong>
        </div>
        <p className={styles.emptyText}>Không có cảnh báo tồn kho đang hiển thị.</p>
      </section>
    );
  }

  return (
    <section className={styles.alertPanel}>
      <div className={styles.panelTitle}>
        <AlertTriangle size={18} />
        <strong>Cảnh báo tồn kho</strong>
      </div>
      <div className={styles.alertList}>
        {alerts.map(({ item, label, tone }) => (
          <article className={`${styles.alertRow} ${styles[`alert_${tone}`]}`} key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <small>
                {label} · {formatNumber(item.currentQuantity)} / ngưỡng {formatNumber(item.lowStockThreshold)} {item.unit}
              </small>
            </div>
            <button type="button" onClick={() => acknowledge(item.id)} aria-label={`Acknowledge ${item.name}`}>
              <X size={15} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value);
}
