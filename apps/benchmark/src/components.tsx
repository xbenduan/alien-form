import { Form, Input as AntInput } from "antd";
import type React from "react";
import type { FieldError } from "@alien-form/react";

export function Input({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value?: string;
  onChange?: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <AntInput
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}

export function FormItem({
  label,
  required,
  errors = [],
  children,
}: {
  label?: string;
  required?: boolean;
  errors?: FieldError[];
  children?: React.ReactNode;
}) {
  return (
    <Form.Item
      label={label}
      required={required}
      validateStatus={errors.length > 0 ? "error" : ""}
      help={errors.length > 0 ? errors.map((e) => e.message).join("; ") : undefined}
      style={{ marginBottom: 12 }}
    >
      {children}
    </Form.Item>
  );
}

export const benchmarkComponents = { Input };
export const benchmarkDecorators = { FormItem };

/**
 * Formily 装饰器:formily 的 ReactiveField 只把 `x-decorator-props` 透传给装饰器,
 * 不像 alien-form 那样自动注入 label/required,因此这些通过 props 传入。
 * 渲染成本与 alien-form 的 FormItem 一致(同样是一个 Antd Form.Item)。
 */
function FormilyFormItem({
  label,
  required,
  children,
}: {
  label?: string;
  required?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Form.Item label={label} required={required} style={{ marginBottom: 12 }}>
      {children}
    </Form.Item>
  );
}

// formily 与 alien-form 复用同一个 Input 组件,保证组件层成本一致。
export const formilyComponents = { Input, FormItem: FormilyFormItem };
