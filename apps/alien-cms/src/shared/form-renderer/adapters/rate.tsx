import React from "react";
import { Rate as AntRate } from "antd";

export const Rate: React.FC<{
  value?: number;
  onChange?: (v: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  format?: string;
}> = ({ value, onChange, disabled, readOnly, format }) => {
  return <AntRate value={value} onChange={(v) => onChange?.(v)} disabled={disabled} />;
};
