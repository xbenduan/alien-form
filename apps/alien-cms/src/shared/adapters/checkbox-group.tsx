import { defineAdapter } from "@alien-form/cms";
import type { DataSourceItem } from "@alien-form/react";
import { Checkbox } from "antd";

function CheckboxGroup({
  value,
  onChange,
  disabled,
  dataSource = [],
}: {
  value?: unknown[];
  onChange?: (nextValue: unknown[]) => void;
  disabled?: boolean;
  dataSource?: DataSourceItem[];
  readOnly?: boolean;
  format?: string;
}) {
  return (
    <Checkbox.Group
      value={value}
      onChange={(nextValue) => onChange?.(nextValue as unknown[])}
      disabled={disabled}
      options={dataSource.map((item) => ({ label: item.label, value: item.value }))}
    />
  );
}

export default defineAdapter(CheckboxGroup, {
  key: "CheckboxGroup",
  label: "多选组件",
  description: "多选组件。",
  kind: "component",
  scenes: ["recordForm", "recordFilter"],
  meta: { fieldType: "tags" },
});
