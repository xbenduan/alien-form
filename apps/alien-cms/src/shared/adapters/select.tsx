import { defineAdapter } from "@alien-form/cms";
import type { DataSourceItem } from "@alien-form/react";
import { Select as AntSelect } from "antd";

function Select({
  value,
  onChange,
  disabled,
  loading,
  dataSource = [],
  placeholder,
  mode,
}: {
  value?: unknown;
  onChange?: (nextValue: unknown) => void;
  disabled?: boolean;
  loading?: boolean;
  dataSource?: DataSourceItem[];
  readOnly?: boolean;
  placeholder?: string;
  mode?: "multiple" | "tags";
  format?: string;
}) {
  return (
    <AntSelect
      style={{ width: "100%" }}
      value={value}
      onChange={(nextValue) => onChange?.(nextValue)}
      disabled={disabled}
      loading={loading}
      placeholder={placeholder}
      mode={mode}
      options={dataSource.map((item) => ({ label: item.label, value: item.value }))}
      allowClear
    />
  );
}

export default defineAdapter({
  component: Select,
  config: {
    key: "Select",
    label: "Select",
    description: "下拉选择组件。",
    kind: "component",
    scenes: ["recordForm", "recordFilter"],
    meta: { fieldType: "string" },
  },
});
