import { defineAdapter } from "@alien-form/cms";
import { InputNumber } from "antd";
import type { BaseFieldProps } from "./types";

function NumberInput({
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
  min,
  max,
}: BaseFieldProps & {
  value?: number;
  onChange?: (nextValue: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <InputNumber
      style={{ width: "100%" }}
      value={value}
      onChange={(nextValue) => onChange?.(nextValue)}
      disabled={disabled || readOnly}
      placeholder={placeholder}
      min={min}
      max={max}
    />
  );
}

export default defineAdapter(NumberInput, {
  key: "NumberInput",
  label: "数字输入",
  description: "数字输入组件。",
  kind: "component",
  scenes: { recordForm: { mode: "edit" }, recordFilter: { mode: "filter" }, recordDetail: { renderAs: "DisplayText" }, tableCell: { renderAs: "DisplayText", summary: true } },
  meta: { fieldType: "number" },
});
