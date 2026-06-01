import React from "react";
import { Input as AntInput, InputNumber } from "antd";

const { TextArea } = AntInput;

export const Input: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
}> = ({ value, onChange, disabled, placeholder, type }) => {
  if (type === "number") {
    return (
      <InputNumber
        value={value as any}
        onChange={(v) => onChange?.(v as any)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full"
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

export const Textarea: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}> = ({ value, onChange, disabled, placeholder, rows = 4 }) => (
  <TextArea
    value={value ?? ""}
    onChange={(e) => onChange?.(e.target.value)}
    disabled={disabled}
    placeholder={placeholder}
    rows={rows}
  />
);

export const NumberInput: React.FC<{
  value?: number;
  onChange?: (v: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
}> = ({ value, onChange, disabled, placeholder, min, max }) => (
  <InputNumber
    value={value}
    onChange={(v) => onChange?.(v)}
    disabled={disabled}
    placeholder={placeholder}
    min={min}
    max={max}
    className="w-full"
  />
);
