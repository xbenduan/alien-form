import type { ReactNode } from "react";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useFormScope, type FieldError, type ValidateStatus } from "@alien-form/react";
import { Tooltip } from "antd";
import type { FormScope } from "../types/shared";
import styles from "./index.module.css";

interface FormItemProps {
  label?: string;
  required?: boolean;
  errors?: FieldError[];
  description?: string;
  validateStatus?: ValidateStatus;
  children?: ReactNode;
}

/** form 场景的字段装饰器：标签 + 必填标记 + 校验错误提示。 */
export function FormItem({
  label,
  required,
  errors = [],
  description,
  validateStatus,
  children,
}: FormItemProps) {
  const { mode = "edit" } = useFormScope<FormScope>();
  const hasError = validateStatus === "error" || errors.length > 0;
  const helpText = errors.map((error) => error.message).join("；");

  return (
    <div className={styles.formItem}>
      {label ? (
        <div className={styles.formItemLabel}>
          {required && mode !== "detail" ? (
            <span className={styles.formItemRequired}>*</span>
          ) : null}
          <span className={styles.formItemLabelText}>{label}</span>
          {description ? (
            <Tooltip title={description}>
              <QuestionCircleOutlined className={styles.formItemDescIcon} />
            </Tooltip>
          ) : null}
        </div>
      ) : null}
      <div className={styles.formItemControl}>
        {children}
        <div className={styles.formItemHelp} role={hasError ? "alert" : undefined}>
          {hasError ? helpText : ""}
        </div>
      </div>
    </div>
  );
}

/** filter 场景的字段装饰器：仅标签，无必填/校验。 */
export function FilterItem({ label, children }: { label?: string; children?: ReactNode }) {
  return (
    <div className={styles.filterItem}>
      {label ? <span className={styles.filterItemLabel}>{label}：</span> : null}
      {children}
    </div>
  );
}
