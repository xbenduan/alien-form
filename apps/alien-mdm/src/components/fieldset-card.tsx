import type { CSSProperties, ReactNode } from "react";
import { fieldGridItemStyle } from "@utils/field-grid";
import styles from "./fieldset-card.module.css";

export function FieldsetCard({
  title,
  description,
  gridSpan,
  children,
  style,
}: {
  title?: string;
  description?: string;
  gridSpan?: unknown;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <fieldset className={styles.fieldsetCard} style={{ ...fieldGridItemStyle(gridSpan), ...style }}>
      {title ? <legend className={styles.title}>{title}</legend> : null}
      {description ? <div className={styles.description}>{description}</div> : null}
      <div className={styles.body}>{children}</div>
    </fieldset>
  );
}
