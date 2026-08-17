import type React from "react";
import { QuestionCircleOutlined } from "@ant-design/icons";
import type { FieldError, ValidateStatus } from "@alien-form/react";
import { Tooltip } from "antd";

interface FormItemProps {
  label?: string;
  required?: boolean;
  errors?: FieldError[];
  warnings?: FieldError[];
  description?: string;
  validateStatus?: ValidateStatus;
  layout?: "horizontal" | "vertical";
  children?: React.ReactNode;
}

export function FormItem({
  label,
  required,
  errors = [],
  warnings = [],
  description,
  validateStatus,
  layout = "horizontal",
  children,
}: FormItemProps) {
  let status: "" | "success" | "warning" | "error" | "validating" = "";
  if (validateStatus === "error" || errors.length > 0) status = "error";
  else if (validateStatus === "warning" || warnings.length > 0) status = "warning";
  else if (validateStatus === "validating") status = "validating";
  else if (validateStatus === "success") status = "success";

  const helpText =
    errors.length > 0
      ? errors.map((error) => error.message).join("; ")
      : warnings.length > 0
        ? warnings.map((warning) => warning.message).join("; ")
        : undefined;
  const statusClassName =
    status === "error"
      ? " schema-form-item-status-error"
      : status === "warning"
        ? " schema-form-item-status-warning"
        : "";
  const layoutClassName =
    layout === "vertical" ? " schema-form-item-vertical" : " schema-form-item-horizontal";

  return (
    <div className={`schema-form-item${layoutClassName}${statusClassName}`}>
      {label ? (
        <div className="schema-form-item-label-row">
          <span className="schema-form-item-label">
            {required ? (
              <span className="schema-form-item-required" aria-hidden="true">
                *
              </span>
            ) : null}
            <Tooltip title={label}>
              <span className="schema-form-item-label-text">{label}</span>
            </Tooltip>
            {description ? (
              <Tooltip title={description}>
                <QuestionCircleOutlined className="schema-form-item-label-icon" />
              </Tooltip>
            ) : null}
          </span>
        </div>
      ) : null}
      <div className="schema-form-item-control">
        {children}
        <div className="schema-form-item-help" role={status === "error" ? "alert" : undefined}>
          {helpText ?? ""}
        </div>
      </div>
    </div>
  );
}
