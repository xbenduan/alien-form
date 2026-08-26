import type { ComponentProps } from "@alien-form/engine/react";
import styles from "../ui.module.css";

export function Page({ children }: ComponentProps) {
  return <div className={styles.pageStack}>{children as React.ReactNode}</div>;
}
