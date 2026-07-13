"use client";

import { Building2, Coffee, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./AdminHub.module.scss";

export function AdminHub({ displayName }: { displayName: string }) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}><span className={styles.brandMark}><Coffee size={24} /></span><div><span>LAC GARDEN</span><strong>Admin Hub</strong></div></div>
        <div className={styles.account}><ShieldCheck size={17} /><span>{displayName}</span><button onClick={() => void signOut()} aria-label="Đăng xuất"><LogOut size={17} /></button></div>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>KHU VỰC QUẢN TRỊ</span>
        <h1>Chọn module để bắt đầu</h1>
        <p>Quản lý hoạt động kinh doanh và tài sản cho Lac Garden từ một nơi.</p>
      </section>

      <section className={styles.moduleGrid} aria-label="Các module quản lý">
        <Link className={styles.moduleCard} href="/">
          <span className={`${styles.moduleIcon} ${styles.coffeeIcon}`}><Coffee size={30} /></span>
          <span className={styles.moduleTag}>OPERATIONS</span>
          <h2>Coffee POS</h2>
          <p>Bán hàng, đơn hàng, pha chế, kho, nhân sự và báo cáo doanh thu.</p>
          <span className={styles.openLink}>Mở Coffee POS <span aria-hidden="true">→</span></span>
        </Link>
        <Link className={styles.moduleCard} href="/dorm">
          <span className={`${styles.moduleIcon} ${styles.dormIcon}`}><Building2 size={30} /></span>
          <span className={styles.moduleTag}>PROPERTY OPERATIONS</span>
          <h2>Dorm Management</h2>
          <p>Cơ sở, phòng/giường, khách thuê, hợp đồng, hóa đơn và tiền thuê.</p>
          <span className={styles.openLink}>Mở Dorm Management <span aria-hidden="true">→</span></span>
        </Link>
      </section>
    </main>
  );
}
