/**
 * Antd-style FormItem decorator for alien-form.
 *
 * Receives: { label, required, errors, warnings, description, validateStatus, children }
 */
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
  colon?: boolean;
  labelCol?: { span?: number };
  wrapperCol?: { span?: number };
}

export const FormItem: React.FC<FormItemProps> = ({
  label,
  required,
  errors = [],
  warnings = [],
  description,
  validateStatus,
  children,
  colon = true,
  labelCol = { span: 6 },
  wrapperCol = { span: 18 },
}) => {
  // Map alien-form validateStatus to antd validateStatus
  let antdStatus: "" | "success" | "warning" | "error" | "validating" = "";
  if (validateStatus === "error" || errors.length > 0) antdStatus = "error";
  else if (validateStatus === "warning" || warnings.length > 0) antdStatus = "warning";
  else if (validateStatus === "validating") antdStatus = "validating";
  else if (validateStatus === "success") antdStatus = "success";

  const helpMessage = errors.length > 0
    ? errors.map((e) => e.message).join("; ")
    : warnings.length > 0
    ? warnings.map((w) => w.message).join("; ")
    : undefined;

  const labelNode = label ? (
    <span>
      {label}
      {description && (
        <Tooltip title={description}>
          <QuestionCircleOutlined style={{ marginLeft: 4, color: "#999" }} />
        </Tooltip>
      )}
    </span>
  ) : undefined;

  return (
    <Form.Item
      label={labelNode}
      required={required}
      validateStatus={antdStatus}
      help={helpMessage}
      colon={colon}
      labelCol={labelCol}
      wrapperCol={wrapperCol}
      style={{ marginBottom: 16 }}
    >
      {children}
    </Form.Item>
  );
};
