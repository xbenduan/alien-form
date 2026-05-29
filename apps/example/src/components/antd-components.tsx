/**
 * Antd component adapters for alien-form.
 *
 * Each component receives: { value, onChange, disabled, loading, dataSource?, ...props }
 * onChange should emit the raw value (not event).
 */
import React from "react";
import {
  Input as AntInput,
  InputNumber as AntInputNumber,
  Select as AntSelect,
  Switch as AntSwitch,
  DatePicker as AntDatePicker,
  Radio as AntRadio,
  Checkbox as AntCheckbox,
  Rate as AntRate,
} from "antd";
import type { DataSourceItem } from "@alien-form/core";
import dayjs from "dayjs";

const { TextArea: AntTextArea } = AntInput;

// ─── Input ────────────────────────────────────────────────────────────────

export const Input: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
  [key: string]: any;
}> = ({ value, onChange, disabled, placeholder, type, ...rest }) => {
  if (type === "number") {
    return (
      <AntInputNumber
        value={value}
        onChange={(v) => onChange?.(v as any)}
        disabled={disabled}
        placeholder={placeholder}
        style={{ width: "100%" }}
      />
    );
  }
  return (
    <AntInput
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
};

// ─── Textarea ─────────────────────────────────────────────────────────────

export const Textarea: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}> = ({ value, onChange, disabled, placeholder, rows = 4 }) => (
  <AntTextArea
    value={value ?? ""}
    onChange={(e) => onChange?.(e.target.value)}
    disabled={disabled}
    placeholder={placeholder}
    rows={rows}
  />
);

// ─── Select ───────────────────────────────────────────────────────────────

export const Select: React.FC<{
  value?: any;
  onChange?: (v: any) => void;
  disabled?: boolean;
  loading?: boolean;
  dataSource?: DataSourceItem[];
  placeholder?: string;
  mode?: "multiple" | "tags";
}> = ({ value, onChange, disabled, loading, dataSource = [], placeholder, mode }) => (
  <AntSelect
    value={value}
    onChange={(v) => onChange?.(v)}
    disabled={disabled}
    loading={loading}
    placeholder={placeholder}
    mode={mode}
    options={dataSource.map((item) => ({ label: item.label, value: item.value }))}
    style={{ width: "100%" }}
    allowClear
  />
);

// ─── Switch ───────────────────────────────────────────────────────────────

export const Switch: React.FC<{
  value?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <AntSwitch checked={!!value} onChange={(v) => onChange?.(v)} disabled={disabled} />
);

// ─── DateInput ────────────────────────────────────────────────────────────

export const DateInput: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}> = ({ value, onChange, disabled, placeholder }) => (
  <AntDatePicker
    value={value ? dayjs(value) : null}
    onChange={(_, dateStr) => onChange?.(dateStr as string)}
    disabled={disabled}
    placeholder={placeholder}
    style={{ width: "100%" }}
  />
);

// ─── Radio ────────────────────────────────────────────────────────────────

export const Radio: React.FC<{
  value?: any;
  onChange?: (v: any) => void;
  disabled?: boolean;
  dataSource?: DataSourceItem[];
}> = ({ value, onChange, disabled, dataSource = [] }) => (
  <AntRadio.Group value={value} onChange={(e) => onChange?.(e.target.value)} disabled={disabled}>
    {dataSource.map((item) => (
      <AntRadio key={item.value} value={item.value}>
        {item.label}
      </AntRadio>
    ))}
  </AntRadio.Group>
);

// ─── Checkbox ─────────────────────────────────────────────────────────────

export const CheckboxGroup: React.FC<{
  value?: any[];
  onChange?: (v: any[]) => void;
  disabled?: boolean;
  dataSource?: DataSourceItem[];
}> = ({ value, onChange, disabled, dataSource = [] }) => (
  <AntCheckbox.Group
    value={value}
    onChange={(v) => onChange?.(v as any[])}
    disabled={disabled}
    options={dataSource.map((item) => ({ label: item.label, value: item.value }))}
  />
);

// ─── Rate ─────────────────────────────────────────────────────────────────

export const Rate: React.FC<{
  value?: number;
  onChange?: (v: number) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <AntRate value={value} onChange={(v) => onChange?.(v)} disabled={disabled} />
);
