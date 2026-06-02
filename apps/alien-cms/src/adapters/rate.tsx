import React from "react";
import { Rate as AntRate } from "antd";
import { FormatValue } from "./format-value";

export const Rate: React.FC<{
  value?: number;
  onChange?: (v: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  format?: string;
}> = ({ value, onChange, disabled, readOnly, format }) => {
  if (readOnly) {
    return <FormatValue value={value} format={format} />;
  }

  return <AntRate value={value} onChange={(v) => onChange?.(v)} disabled={disabled} />;
};
