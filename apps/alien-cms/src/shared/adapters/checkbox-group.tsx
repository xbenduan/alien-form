import type { DataSourceItem } from "@alien-form/react";
import { Checkbox } from "../ui";
import type { BaseFieldProps } from "./types";

export function CheckboxGroup({
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

export default CheckboxGroup;
