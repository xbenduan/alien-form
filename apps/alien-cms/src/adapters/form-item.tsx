import type React from 'react';
import { Form, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import type { FieldError, ValidateStatus } from '@alien-form/react';

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
  let status: '' | 'success' | 'warning' | 'error' | 'validating' = '';
  if (validateStatus === 'error' || errors.length > 0) status = 'error';
  else if (validateStatus === 'warning' || warnings.length > 0) status = 'warning';
  else if (validateStatus === 'validating') status = 'validating';
  else if (validateStatus === 'success') status = 'success';

  const help = errors.length > 0
    ? errors.map((error) => error.message).join('; ')
    : warnings.length > 0
      ? warnings.map((warning) => warning.message).join('; ')
      : undefined;

  const labelNode = label ? (
    <span>
      {label}
      {description ? (
        <Tooltip title={description}>
          <QuestionCircleOutlined style={{ color: '#98a2b3', marginInlineStart: 6 }} />
        </Tooltip>
      ) : null}
    </span>
  ) : undefined;

  return (
    <Form.Item
      label={labelNode}
      required={required}
      validateStatus={status}
      help={help}
      style={{ marginBottom: 16 }}
    >
      {children}
    </Form.Item>
  );
}
