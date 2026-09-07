import type { ReactNode } from "react";
import styles from "./index.module.css";
import { LayoutLoadingProvider } from "./loading-context";

export function Layout({
  slots,
  children,
}: {
  slots: Record<string, ReactNode>;
  children?: ReactNode;
}) {
  const rightSlots = Object.entries(slots)
    .filter(([name]) => name !== "left")
    .map(([name, content]) => <div key={name}>{content}</div>);

  return (
    <LayoutLoadingProvider>
      <div className={styles.layout}>
        {slots.left ? <aside className={styles.layoutLeft}>{slots.left}</aside> : null}
        <main className={styles.layoutMain}>
          {rightSlots}
          {children}
        </main>
      </div>
    </LayoutLoadingProvider>
  );
}
