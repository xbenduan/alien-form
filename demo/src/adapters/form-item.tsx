import React from "react";
import { Form, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import type { FieldError, ValidateStatus } from "@alien-form/core";

interface FormItemProps {
  label?: string;
  required?: boolean;
  errors?: FieldError[];
  warnings?: FieldError[];
  description?: string;
  validateStatus?: ValidateStatus;
  children?: React.ReactNode;
}

export const FormItem: React.FC<FormItemProps> = ({
  label,
  required,
  errors = [],
  warnings = [],
  description,
  validateStatus,
  children,
}) => {
  let status: "" | "success" | "warning" | "error" | "validating" = "";
  if (validateStatus === "error" || errors.length > 0) status = "error";
  else if (validateStatus === "warning" || warnings.length > 0) status = "warning";
  else if (validateStatus === "validating") status = "validating";
  else if (validateStatus === "success") status = "success";

  const help = errors.length > 0
    ? errors.map((e) => e.message).join("; ")
    : warnings.length > 0
    ? warnings.map((w) => w.message).join("; ")
    : undefined;

  const labelNode = label ? (
    <span>
      {label}
      {description && (
        <Tooltip title={description}>
          <QuestionCircleOutlined className="ml-1 text-gray-400" />
        </Tooltip>
      )}
    </span>
  ) : undefined;

  return (
    <Form.Item
      label={labelNode}
      required={required}
      validateStatus={status}
      help={help}
      className="mb-4"
    >
      {children}
    </Form.Item>
  );
};
