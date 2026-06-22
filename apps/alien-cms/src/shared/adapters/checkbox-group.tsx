import { defineAdapter } from "@alien-form/cms";
import type { DataSourceItem } from "@alien-form/react";
import { Checkbox } from "antd";
import type { BaseFieldProps } from "./types";

function CheckboxGroup({
  value,
  onChange,
  disabled,
  readOnly,
  dataSource = [],
}: BaseFieldProps & {
  value?: unknown[];
  onChange?: (nextValue: unknown[]) => void;
  dataSource?: DataSourceItem[];
}) {
  return (
    <Checkbox.Group
      value={value}
      onChange={(nextValue) => onChange?.(nextValue as unknown[])}
      disabled={disabled || readOnly}
      options={dataSource.map((item) => ({ label: item.label, value: item.value }))}
    />
  );
}

export default defineAdapter(CheckboxGroup, {
  key: "CheckboxGroup",
  label: "多选组件",
  description: "多选组件。",
  kind: "component",
  scenes: { form: {}, filter: {}, detail: "DisplayChoice", table: { renderAs: "DisplayChoice", summary: true } },
  meta: { fieldType: "tags" },
});
