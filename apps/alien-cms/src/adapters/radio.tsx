import React from "react";
import { Radio as AntRadio } from "antd";
import type { DataSourceItem } from "@alien-form/core";

export const Radio: React.FC<{
  value?: any;
  onChange?: (v: any) => void;
  disabled?: boolean;
  dataSource?: DataSourceItem[];
}> = ({ value, onChange, disabled, dataSource = [] }) => (
  <AntRadio.Group value={value} onChange={(e) => onChange?.(e.target.value)} disabled={disabled}>
    {dataSource.map((item) => (
      <AntRadio key={item.value} value={item.value}>{item.label}</AntRadio>
    ))}
  </AntRadio.Group>
);
