import { Radio as AntRadio } from 'antd';
import type { DataSourceItem } from '@alien-form/react';

export function Radio({
  value,
  onChange,
  disabled,
  dataSource = [],
}: {
  value?: unknown;
  onChange?: (nextValue: unknown) => void;
  disabled?: boolean;
  dataSource?: DataSourceItem[];
}) {
  return (
    <AntRadio.Group value={value} onChange={(event) => onChange?.(event.target.value)} disabled={disabled}>
      {dataSource.map((item) => (
        <AntRadio key={item.value} value={item.value}>
          {item.label}
        </AntRadio>
      ))}
    </AntRadio.Group>
  );
}
