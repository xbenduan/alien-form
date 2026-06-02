import { Checkbox } from 'antd';
import type { DataSourceItem } from '@alien-form/react';
import { FormatValue } from './format-value';

export function CheckboxGroup({
  value,
  onChange,
  disabled,
  dataSource = [],
  readOnly,
  format,
}: {
  value?: unknown[];
  onChange?: (nextValue: unknown[]) => void;
  disabled?: boolean;
  dataSource?: DataSourceItem[];
  readOnly?: boolean;
  format?: string;
}) {
  if (readOnly) {
    return <FormatValue value={value} dataSource={dataSource} format={format} />;
  }

  return (
    <Checkbox.Group
      value={value}
      onChange={(nextValue) => onChange?.(nextValue as unknown[])}
      disabled={disabled}
      options={dataSource.map((item) => ({ label: item.label, value: item.value }))}
    />
  );
}
