import React from "react";
import { Checkbox } from "antd";
import type { DataSourceItem } from "@alien-form/core";

export const CheckboxGroup: React.FC<{
  value?: any[];
  onChange?: (v: any[]) => void;
  disabled?: boolean;
  dataSource?: DataSourceItem[];
}> = ({ value, onChange, disabled, dataSource = [] }) => (
  <Checkbox.Group
    value={value}
    onChange={(v) => onChange?.(v as any[])}
    disabled={disabled}
    options={dataSource.map((d) => ({ label: d.label, value: d.value }))}
  />
);
