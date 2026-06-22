import type React from "react";
import { QuestionCircleOutlined } from "@ant-design/icons";
import type { FieldError, ValidateStatus } from "@alien-form/react";
import { Form, Tooltip } from "antd";

interface FormItemProps {
  label?: string;
  required?: boolean;
  errors?: FieldError[];
  warnings?: FieldError[];
  description?: string;
  validateStatus?: ValidateStatus;
  children?: React.ReactNode;
}

export function FormItem({
  label,
  required,
  errors = [],
  warnings = [],
  description,
  validateStatus,
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

  const help = helpText ?? "​";

  const labelNode = label ? (
    <span className="cms-form-item-label">
      <Tooltip title={label}>
        <span className="cms-form-item-label-text">{label}</span>
      </Tooltip>
      {description ? (
        <Tooltip title={description}>
          <QuestionCircleOutlined className="cms-form-item-label-icon" />
        </Tooltip>
      ) : null}
    </span>
  ) : undefined;

  return (
    <Form.Item
      className={`cms-form-item${helpText ? "" : " cms-form-item-help-placeholder"}`}
      label={labelNode}
      colon={false}
      required={required}
      validateStatus={status}
      help={help}
      style={{ marginBottom: 16 }}
    >
      {children}
    </Form.Item>
  );
}

export default FormItem;
