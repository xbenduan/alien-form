import type { ReactNode } from "react";
import styles from "./layout.module.css";
import { LayoutLoadingProvider } from "./loading-context";

export function Layout({
  slots,
  children,
}: {
  slots: Record<string, ReactNode>;
  children?: ReactNode;
}) {
  return (
    <LayoutLoadingProvider>
      <div className={styles.layout}>
        {slots.left ? <aside className={styles.layoutLeft}>{slots.left}</aside> : null}
        <main className={styles.layoutMain}>
          {slots.content}
          {children}
        </main>
      </div>
    </LayoutLoadingProvider>
  );
}
