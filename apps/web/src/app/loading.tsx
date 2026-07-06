import styles from "./loading.module.scss";

export default function Loading() {
  return (
    <main className={styles.shell} aria-busy="true" aria-live="polite">
      <section className={styles.panel}>
        <span className={styles.spinner} aria-hidden="true" />
        <h1 className={styles.title}>Đang tải dữ liệu</h1>
        <p className={styles.subtitle}>Lac Garden POS</p>
      </section>
    </main>
  );
}
