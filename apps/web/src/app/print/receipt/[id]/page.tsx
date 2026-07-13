import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth";
import { getPrintableReceipt } from "@/server/pos";
import { formatVnd } from "@/lib/money";
import { PrintActions } from "../../PrintActions";
import styles from "../../Print.module.scss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hoá đơn | Lac Garden POS"
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
          <p>Hoá đơn</p>
          <strong>{receipt.orderNo}</strong>
          <span>{receipt.orderTypeLabel}</span>
        </header>

        <section className={styles.meta}>
          <div>
            <span>Thu ngân</span>
            <strong>{receipt.cashierName}</strong>
          </div>
          <div>
            <span>Tạo lúc</span>
            <strong>{formatDateTime(receipt.createdAt)}</strong>
          </div>
          <div>
            <span>Thanh toán</span>
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
            <span>Tạm tính</span>
            <span>{formatVnd(receipt.subtotal)}</span>
          </div>
          <div>
            <span>Giảm giá</span>
            <span>{formatVnd(receipt.discountTotal)}</span>
          </div>
          <div>
            <strong>Tổng cộng</strong>
            <strong>{formatVnd(receipt.total)}</strong>
          </div>
        </section>

        <footer className={styles.footer}>
          {receipt.payments.map((payment) => (
            <small key={payment.id}>
              {paymentMethodText(payment.method)} · {formatVnd(payment.amount)} · {formatDateTime(payment.createdAt)}
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

function paymentMethodText(method: string) {
  const labels: Record<string, string> = {
    CASH: "Tiền mặt",
    CARD: "Thẻ",
    BANK_TRANSFER: "Chuyển khoản",
    QR: "QR"
  };
  return labels[method] ?? method;
}
