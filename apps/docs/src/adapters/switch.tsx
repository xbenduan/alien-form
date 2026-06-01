import React from "react";
import { Switch as AntSwitch } from "antd";

export const Switch: React.FC<{
  value?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <AntSwitch checked={!!value} onChange={(v) => onChange?.(v)} disabled={disabled} />
);
