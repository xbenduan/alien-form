import type { ReactNode } from "react";
import type { ComponentProps } from "@alien-form/react";
import styles from "./record-page.module.css";

export function RecordPage({ children }: Partial<ComponentProps> & { title?: ReactNode }) {
  return <div className={styles.recordPage}>{children}</div>;
}
