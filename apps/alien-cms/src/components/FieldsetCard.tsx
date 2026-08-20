import type { ReactNode } from "react";
import styles from "./index.module.css";

interface FieldsetCardProps {
  title?: ReactNode;
  children?: ReactNode;
}

export const FieldsetCard = ({ title, children }: FieldsetCardProps) => (
  <div className={`${styles.fieldsetCard} ${styles.configStack}`}>
    <fieldset className={`${styles.configLayout}`}>
      <legend className={styles.configTitle}>{title}</legend>
      {children}
    </fieldset>
  </div>
);
