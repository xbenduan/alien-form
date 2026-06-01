import React from "react";
import { Rate as AntRate } from "antd";

export const Rate: React.FC<{
  value?: number;
  onChange?: (v: number) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <AntRate value={value} onChange={(v) => onChange?.(v)} disabled={disabled} />
);
