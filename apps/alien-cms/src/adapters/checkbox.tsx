import { Checkbox } from 'antd';
import type { DataSourceItem } from '@alien-form/react';

export function CheckboxGroup({
  value,
  onChange,
  disabled,
  dataSource = [],
}: {
  value?: unknown[];
  onChange?: (nextValue: unknown[]) => void;
  disabled?: boolean;
  dataSource?: DataSourceItem[];
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
