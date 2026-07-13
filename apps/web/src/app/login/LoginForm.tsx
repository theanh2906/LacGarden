"use client";

import { Loader2, LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import styles from "./LoginPage.module.scss";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin })
      });

      if (!response.ok) {
        setError("Sai username hoặc PIN.");
        return;
      }

      router.replace(isSafeNextPath(nextPath) ? nextPath : "/");
      router.refresh();
    } catch (loginError) {
      console.info("[auth-ui] Login failed", loginError);
      setError("Không thể đăng nhập. Kiểm tra kết nối hoặc admin logs.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submitLogin}>
      <label>
        <span>Username</span>
        <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus />
      </label>
      <label>
        <span>PIN</span>
        <input
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          type="password"
          autoComplete="current-password"
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button type="submit" disabled={isSubmitting || !username.trim() || pin.trim().length < 4}>
        {isSubmitting ? <Loader2 className={styles.spinner} size={18} /> : <LogIn size={18} />}
        {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}

function isSafeNextPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}
