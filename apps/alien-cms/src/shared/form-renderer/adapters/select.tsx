import { Select as AntSelect } from 'antd';
import type { DataSourceItem } from '@alien-form/react';

export function Select({
  value,
  onChange,
  disabled,
  loading,
  dataSource = [],
  readOnly,
  placeholder,
  mode,
  format,
}: {
  value?: unknown;
  onChange?: (nextValue: unknown) => void;
  disabled?: boolean;
  loading?: boolean;
  dataSource?: DataSourceItem[];
  readOnly?: boolean;
  placeholder?: string;
  mode?: 'multiple' | 'tags';
  format?: string;
}) {
  return (
    <AntSelect
      style={{ width: '100%' }}
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
