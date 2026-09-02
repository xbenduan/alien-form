import type { ReactNode } from "react";
import type { ComponentProps } from "@binding";
import styles from "./index.module.css";

export function RecordPage({ children }: Partial<ComponentProps> & { title?: ReactNode }) {
  return <div className={styles.recordPage}>{children}</div>;
}
