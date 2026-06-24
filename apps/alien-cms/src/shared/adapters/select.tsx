import { defineAdapter } from "@alien-form/cms";
import type { DataSourceItem } from "@alien-form/react";
import { Select as AntSelect } from "../ui";
import type { BaseFieldProps } from "./types";

function Select({
  value,
  onChange,
  disabled,
  readOnly,
  loading,
  dataSource = [],
  placeholder,
  mode,
}: BaseFieldProps & {
  onChange?: (nextValue: unknown) => void;
  loading?: boolean;
  dataSource?: DataSourceItem[];
  mode?: "multiple" | "tags";
}) {
  return (
    <AntSelect
      style={{ width: "100%" }}
      value={value}
      onChange={(nextValue) => onChange?.(nextValue)}
      disabled={disabled || readOnly}
      loading={loading}
      placeholder={placeholder}
      mode={mode}
      options={dataSource.map((item) => ({ label: item.label, value: item.value }))}
      allowClear
    />
  );
}

export default defineAdapter(Select, {
  key: "Select",
  label: "下拉选择组件",
  description: "下拉选择组件。",
  kind: "component",
  scenes: { form: {}, filter: { operator: "in" }, detail: "DisplayChoice", table: { renderAs: "DisplayChoice", summary: true } },
  meta: { fieldType: "string" },
});
