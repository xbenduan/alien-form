import type { DataSourceItem } from "@alien-form/react";
import { Select as AntSelect } from "../ui";
import type { BaseFieldProps } from "./types";

export function Select({
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

export default Select;
