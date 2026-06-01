import React from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";

export const DateInput: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}> = ({ value, onChange, disabled, placeholder }) => (
  <DatePicker
    value={value ? dayjs(value) : null}
    onChange={(_, dateStr) => onChange?.(dateStr as string)}
    disabled={disabled}
    placeholder={placeholder}
    className="w-full"
  />
);
