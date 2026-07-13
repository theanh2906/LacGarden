import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth";
import { getPrintableBarTicket } from "@/server/pos";
import { PrintActions } from "../../PrintActions";
import styles from "../../Print.module.scss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Phiếu pha chế | Lac Garden POS"
};

export default async function BarTicketPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("bar:manage", "/");
  const { id } = await params;
  const ticket = await getPrintableBarTicket(id).catch((error) => {
    console.info("[print] Bar ticket load failed", error);
    return null;
  });
  if (!ticket) notFound();

  return (
    <main className={styles.page}>
      <PrintActions />
      <article className={`${styles.ticket} ${styles.barPaper}`}>
        <header className={styles.header}>
          <h1>Phiếu pha chế</h1>
          <strong>{ticket.orderNo}</strong>
          <span>
            {ticket.orderTypeLabel} · {ticket.age} · {orderStatusText(ticket.status)}
          </span>
        </header>

        {ticket.note ? <p className={styles.note}>{ticket.note}</p> : null}

        <section className={styles.items}>
          {ticket.items.map((item) => (
            <div className={styles.barItem} key={item.id}>
              <span className={styles.quantity}>{item.quantity}</span>
              <div className={styles.item}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{barItemStatusText(item.status)}</span>
                </div>
                <small>
                  {item.variant}
                  {item.modifiers.length ? ` · ${item.modifiers.join(", ")}` : " · Mặc định"}
                  {item.note ? ` · ${item.note}` : ""}
                </small>
              </div>
            </div>
          ))}
        </section>

        <footer className={styles.footer}>
          <small>Tạo lúc {formatDateTime(ticket.createdAt)}</small>
        </footer>
      </article>
    </main>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function orderStatusText(status: string) {
  const labels: Record<string, string> = {
    SENT: "Đã gửi",
    PREPARING: "Đang pha",
    READY: "Sẵn sàng",
    SERVED: "Đã phục vụ",
    CLOSED: "Đã đóng",
    CANCELLED: "Đã huỷ"
  };
  return labels[status] ?? status;
}

function barItemStatusText(status: string) {
  const labels: Record<string, string> = {
    Queued: "Đang chờ",
    Brewing: "Đang pha",
    Ready: "Sẵn sàng",
    Served: "Đã phục vụ",
    Cancelled: "Đã huỷ"
  };
  return labels[status] ?? status;
}
