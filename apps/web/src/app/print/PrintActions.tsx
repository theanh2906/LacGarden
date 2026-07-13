"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import styles from "./Print.module.scss";

export function PrintActions() {
  return (
    <nav className={styles.actions} aria-label="Thao tác in">
      <Link href="/">
        <ArrowLeft size={16} /> POS
      </Link>
      <button type="button" onClick={() => window.print()}>
        <Printer size={16} /> In
      </button>
    </nav>
  );
}
