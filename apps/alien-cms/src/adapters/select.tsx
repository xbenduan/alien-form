import React from "react";
import { Select as AntSelect } from "antd";
import type { DataSourceItem } from "@alien-form/core";

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
    options={dataSource.map((d) => ({ label: d.label, value: d.value }))}
    className="w-full"
    allowClear
  />
);
