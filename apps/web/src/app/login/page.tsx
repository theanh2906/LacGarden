import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Coffee } from "lucide-react";
import { getStaffSession } from "@/server/auth";
import { LoginForm } from "./LoginForm";
import styles from "./LoginPage.module.scss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff Login | Lac Garden POS",
  description: "Staff sign-in for Lac Garden POS"
};

export default async function LoginPage() {
  const session = await getStaffSession();
  if (session) redirect("/");

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.mark}>
            <Coffee size={28} />
          </span>
          <div>
            <h1>Lac Garden POS</h1>
            <p>Đăng nhập bằng tài khoản nhân viên để bắt đầu ca bán hàng.</p>
          </div>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
