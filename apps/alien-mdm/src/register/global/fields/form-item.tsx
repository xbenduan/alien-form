import type { ReactNode } from "react";
import { fieldGridItemStyle } from "@utils/field-grid";
import styles from "./form-item.module.css";

export function FormItem({
  title,
  required,
  errors,
  description,
  mode,
  gridSpan,
  children,
}: {
  title?: string;
  required?: boolean;
  errors?: Array<{ message?: string }>;
  description?: string;
  mode?: string;
  gridSpan?: unknown;
  children?: ReactNode;
}) {
  return (
    <div
      className={`${styles.formItem}${mode === "detail" ? ` ${styles.detailFormItem}` : ""}`}
      style={fieldGridItemStyle(gridSpan)}
    >
      {title ? (
        <label className={`${styles.formItemLabel}${required ? ` ${styles.required}` : ""}`}>
          {title}
        </label>
      ) : null}
      <div className={styles.formItemControl}>{children}</div>
      {description ? <div className={styles.formItemDescription}>{description}</div> : null}
      {errors?.[0]?.message ? (
        <div className={styles.formItemError} role="alert">
          {errors[0].message}
        </div>
      ) : null}
    </div>
  );
}
