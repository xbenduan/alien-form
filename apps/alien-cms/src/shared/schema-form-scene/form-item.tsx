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
      ? " cms-form-item-status-error"
      : status === "warning"
        ? " cms-form-item-status-warning"
        : "";

  const layoutClassName =
    layout === "vertical" ? " cms-form-item-vertical" : " cms-form-item-horizontal";

  return (
    <div className={`cms-form-item${layoutClassName}${statusClassName}`}>
      {label ? (
        <div className="cms-form-item-label-row">
          <span className="cms-form-item-label">
            {required ? (
              <span className="cms-form-item-required" aria-hidden="true">
                *
              </span>
            ) : null}
            <Tooltip title={label}>
              <span className="cms-form-item-label-text">{label}</span>
            </Tooltip>
            {description ? (
              <Tooltip title={description}>
                <QuestionCircleOutlined className="cms-form-item-label-icon" />
              </Tooltip>
            ) : null}
          </span>
        </div>
      ) : null}
      <div className="cms-form-item-control">
        {children}
        <div className="cms-form-item-help" role={status === "error" ? "alert" : undefined}>
          {helpText ?? ""}
        </div>
      </div>
    </div>
  );
}

export default FormItem;
