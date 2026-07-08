import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth";
import { getPrintableReceipt } from "@/server/pos";
import { formatVnd } from "@/lib/money";
import { PrintActions } from "../../PrintActions";
import styles from "../../Print.module.scss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Printable Receipt | Lac Garden POS"
};

export default async function ReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("pos:access", "/");
  const { id } = await params;
  const receipt = await getPrintableReceipt(id).catch((error) => {
    console.info("[print] Receipt load failed", error);
    return null;
  });
  if (!receipt) notFound();

  return (
    <main className={styles.page}>
      <PrintActions />
      <article className={`${styles.ticket} ${styles.receiptPaper}`}>
        <header className={styles.header}>
          <h1>Lac Garden Coffee</h1>
          <p>Receipt</p>
          <strong>{receipt.orderNo}</strong>
          <span>{receipt.orderTypeLabel}</span>
        </header>

        <section className={styles.meta}>
          <div>
            <span>Cashier</span>
            <strong>{receipt.cashierName}</strong>
          </div>
          <div>
            <span>Created</span>
            <strong>{formatDateTime(receipt.createdAt)}</strong>
          </div>
          <div>
            <span>Paid</span>
            <strong>{receipt.paidAt ? formatDateTime(receipt.paidAt) : "-"}</strong>
          </div>
        </section>

        <section className={styles.items}>
          {receipt.items.map((item) => (
            <div className={styles.item} key={item.id}>
              <div>
                <strong>
                  {item.quantity} x {item.name}
                </strong>
                <span>{formatVnd(item.lineTotal)}</span>
              </div>
              <small>
                {item.variant} · {formatVnd(item.unitPrice)}
                {item.modifiers.length ? ` · ${item.modifiers.join(", ")}` : ""}
                {item.note ? ` · ${item.note}` : ""}
              </small>
            </div>
          ))}
        </section>

        <section className={styles.totals}>
          <div>
            <span>Subtotal</span>
            <span>{formatVnd(receipt.subtotal)}</span>
          </div>
          <div>
            <span>Discount</span>
            <span>{formatVnd(receipt.discountTotal)}</span>
          </div>
          <div>
            <strong>Total</strong>
            <strong>{formatVnd(receipt.total)}</strong>
          </div>
        </section>

        <footer className={styles.footer}>
          {receipt.payments.map((payment) => (
            <small key={payment.id}>
              {payment.method} · {formatVnd(payment.amount)} · {formatDateTime(payment.createdAt)}
            </small>
          ))}
          {receipt.note ? <p>{receipt.note}</p> : null}
          <p>Cảm ơn quý khách.</p>
        </footer>
      </article>
    </main>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}
