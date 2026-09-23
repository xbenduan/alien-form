import type { ReactNode } from "react";
import styles from "./page-action-bar.module.css";

export function PageActionBar({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      <div className={styles.bar}>{children}</div>
    </div>
  );
}
