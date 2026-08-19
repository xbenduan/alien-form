import type { ReactNode } from "react";
import { QuestionCircleOutlined } from "@ant-design/icons";
import type { FieldError, ValidateStatus } from "@alien-form/react";
import { Tooltip } from "antd";

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
  const hasError = validateStatus === "error" || errors.length > 0;
  const helpText = errors.map((error) => error.message).join("；");

  return (
    <div className={`af-form-item${hasError ? " af-form-item-error" : ""}`}>
      {label ? (
        <div className="af-form-item-label">
          {required ? <span className="af-form-item-required">*</span> : null}
          <span className="af-form-item-label-text">{label}</span>
          {description ? (
            <Tooltip title={description}>
              <QuestionCircleOutlined className="af-form-item-desc-icon" />
            </Tooltip>
          ) : null}
        </div>
      ) : null}
      <div className="af-form-item-control">
        {children}
        <div className="af-form-item-help" role={hasError ? "alert" : undefined}>
          {hasError ? helpText : ""}
        </div>
      </div>
    </div>
  );
}

/** filter 场景的字段装饰器：仅标签，无必填/校验。 */
export function FilterItem({ label, children }: { label?: string; children?: ReactNode }) {
  return (
    <div className="af-filter-item">
      {label ? <span className="af-filter-item-label">{label}</span> : null}
      {children}
    </div>
  );
}
