import { BedDouble, Coffee, LayoutDashboard, ReceiptText, Users } from "lucide-react";
import styles from "./DormLoading.module.scss";

export default function Loading() {
  return (
    <main className={styles.page} aria-busy="true" aria-live="polite">
      <div className={styles.shell}>
        <aside className={styles.sidebar} aria-label="Đang tải điều hướng Dorm">
          <span className={styles.brandMark} aria-hidden="true"><Coffee size={27} /></span>
          <NavItem icon={<LayoutDashboard size={20} />} label="Tổng quan" />
          <NavItem icon={<BedDouble size={20} />} label="Phòng" />
          <NavItem icon={<Users size={20} />} label="Khách thuê" />
          <NavItem icon={<ReceiptText size={20} />} label="Tài chính" />
        </aside>

        <section className={styles.workspace}>
          <header className={styles.topbar}>
            <div className={styles.storeBlock}>
              <span>LAC GARDEN / DORM</span>
              <strong>Quản lý Dorm</strong>
              <small>Đang tải dữ liệu...</small>
            </div>
            <div className={styles.status}><span className={styles.dot} /> Đang đồng bộ</div>
          </header>

          <div className={styles.content}>
            <div className={styles.pageHeading}>
              <span className={styles.lineLarge} />
              <span className={styles.lineSmall} />
            </div>
            <div className={styles.metrics}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <section className={styles.panel}>
              <span className={styles.lineMedium} />
              <div className={styles.rows}>
                <span /><span /><span /><span />
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function NavItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className={styles.navItem}>{icon}<span>{label}</span></div>;
}

function SkeletonCard() {
  return <div className={styles.card}><span className={styles.lineShort} /><span className={styles.value} /></div>;
}
