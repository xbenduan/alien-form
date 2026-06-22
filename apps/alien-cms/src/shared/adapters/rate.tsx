import { defineAdapter } from "@alien-form/cms";
import { Rate as AntRate } from "antd";
import type { BaseFieldProps } from "./types";

function Rate({
  value,
  onChange,
  disabled,
  readOnly,
}: BaseFieldProps & {
  value?: number;
  onChange?: (v: number) => void;
}) {
  return <AntRate value={value} onChange={(v) => onChange?.(v)} disabled={disabled || readOnly} />;
}

export default defineAdapter(Rate, {
  key: "Rate",
  label: "评分组件",
  description: "评分组件。",
  kind: "component",
  scenes: { form: {}, filter: {}, detail: "DisplayRate", table: { renderAs: "DisplayRate", summary: true } },
  meta: { fieldType: "number" },
});
