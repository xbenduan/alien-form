import { defineAdapter } from "@alien-form/cms";
import { Rate as AntRate } from "antd";

function Rate({
  value,
  onChange,
  disabled,
}: {
  value?: number;
  onChange?: (v: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  format?: string;
}) {
  return <AntRate value={value} onChange={(v) => onChange?.(v)} disabled={disabled} />;
}

export default defineAdapter(Rate, {
  key: "Rate",
  label: "评分组件",
  description: "评分组件。",
  kind: "component",
  scenes: ["recordForm", "recordFilter"],
  meta: { fieldType: "number" },
});
